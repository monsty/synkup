import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import type { AlbumDto, CoverUploadUrlDto } from '@synkup/shared';

import { AlbumRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UsersService } from '../users/users.service.js';
import type { CreateAlbumDto, UpdateAlbumDto } from './albums.dto.js';
import { albumPrefix, coverPrefix } from './media-keys.js';

const ALBUM_INCLUDE = {
  members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
  _count: { select: { photos: true } },
  photos: {
    orderBy: { takenAt: 'desc' },
    take: 1,
    select: { displayKey: true },
  },
} as const;

/** Rôles au format de l'app (minuscules). */
const ROLE = {
  [AlbumRole.OWNER]: 'owner',
  [AlbumRole.MEMBER]: 'member',
} as const;

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  /**
   * Albums de l'utilisateur, avec membres, nombre de photos et couverture.
   * Tri : en cours, à venir, terminés, à la charge du client (il connaît « aujourd'hui »).
   */
  async listForUser(userId: string): Promise<AlbumDto[]> {
    const memberships = await this.prisma.albumMember.findMany({
      where: { userId },
      select: { albumId: true },
    });
    return this.load(
      memberships.map((m) => m.albumId),
      userId,
    );
  }

  async getForUser(albumId: string, userId: string): Promise<AlbumDto> {
    await this.memberRole(albumId, userId);
    const [album] = await this.load([albumId], userId);
    return album;
  }

  /** Crée l'album ; son créateur en est le propriétaire et, pour l'instant, le seul membre. */
  async create(userId: string, input: CreateAlbumDto) {
    assertPeriod(input.startDate, input.endDate);
    const album = await this.prisma.album.create({
      data: {
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        members: { create: { userId, role: AlbumRole.OWNER } },
      },
    });
    return this.getForUser(album.id, userId);
  }

  async update(albumId: string, userId: string, input: UpdateAlbumDto) {
    await this.assertOwner(albumId, userId);
    const current = await this.prisma.album.findUniqueOrThrow({
      where: { id: albumId },
    });
    assertPeriod(
      input.startDate ?? current.startDate,
      input.endDate ?? current.endDate,
    );
    if (input.coverKey) await this.assertCoverUploaded(albumId, input.coverKey);
    await this.prisma.album.update({
      where: { id: albumId },
      data: {
        name: input.name?.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        coverKey: input.coverKey,
      },
    });
    // L'ancienne couverture n'est plus référencée nulle part.
    if (
      input.coverKey !== undefined &&
      current.coverKey &&
      current.coverKey !== input.coverKey
    ) {
      await this.storage.deleteQuietly([current.coverKey]);
    }
    return this.getForUser(albumId, userId);
  }

  /** Supprime l'album, ses membres, photos et invitations (cascade), puis ses fichiers. */
  async remove(albumId: string, userId: string) {
    await this.assertOwner(albumId, userId);
    await this.prisma.album.delete({ where: { id: albumId } });
    await this.storage.deletePrefixQuietly(albumPrefix(albumId));
  }

  /** URL d'envoi d'une couverture choisie à la main ; à confirmer ensuite par `update`. */
  async coverUpload(
    albumId: string,
    userId: string,
    byteSize: number,
  ): Promise<CoverUploadUrlDto> {
    await this.assertOwner(albumId, userId);
    const key = `${coverPrefix(albumId)}${randomUUID()}.jpg`;
    return {
      key,
      uploadUrl: await this.storage.uploadUrl(key, 'image/jpeg', byteSize),
    };
  }

  private async assertCoverUploaded(albumId: string, key: string) {
    if (
      !key.startsWith(coverPrefix(albumId)) ||
      (await this.storage.size(key)) === null
    ) {
      throw new BadRequestException(
        "Couverture introuvable : l'envoi n'est pas terminé.",
      );
    }
  }

  /** Nommer un nouveau propriétaire rétrograde l'ancien en membre. */
  async updateMemberRole(
    albumId: string,
    userId: string,
    memberId: string,
    role: 'owner' | 'member',
  ) {
    await this.assertOwner(albumId, userId);
    await this.memberRole(albumId, memberId);
    if (role === 'member') {
      throw new BadRequestException(
        'Pour changer de propriétaire, nomme un autre membre propriétaire.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.albumMember.updateMany({
        where: { albumId, role: AlbumRole.OWNER },
        data: { role: AlbumRole.MEMBER },
      }),
      this.prisma.albumMember.update({
        where: { albumId_userId: { albumId, userId: memberId } },
        data: { role: AlbumRole.OWNER },
      }),
    ]);
    return this.getForUser(albumId, userId);
  }

  /** Le propriétaire retire un membre ; jamais lui-même. */
  async removeMember(albumId: string, userId: string, memberId: string) {
    await this.assertOwner(albumId, userId);
    if (memberId === userId)
      throw new BadRequestException('Le propriétaire ne peut pas se retirer.');
    await this.memberRole(albumId, memberId);
    await this.prisma.albumMember.delete({
      where: { albumId_userId: { albumId, userId: memberId } },
    });
    return this.getForUser(albumId, userId);
  }

  /**
   * Quitte l'album. Les photos qu'on y a envoyées y restent : on les a partagées. Le
   * propriétaire, lui, transfère ou supprime l'album.
   */
  async leave(albumId: string, userId: string) {
    const role = await this.memberRole(albumId, userId);
    if (role === AlbumRole.OWNER) {
      throw new BadRequestException(
        "Le propriétaire ne peut pas quitter l'album : transfère-le à un membre ou supprime-le.",
      );
    }
    await this.prisma.albumMember.delete({
      where: { albumId_userId: { albumId, userId } },
    });
  }

  /** Rôle de l'utilisateur dans l'album ; 404 s'il n'en est pas membre (on ne révèle rien). */
  async memberRole(albumId: string, userId: string): Promise<AlbumRole> {
    const member = await this.prisma.albumMember.findUnique({
      where: { albumId_userId: { albumId, userId } },
      select: { role: true },
    });
    if (!member) throw new NotFoundException('Album introuvable.');
    return member.role;
  }

  async assertOwner(albumId: string, userId: string) {
    if ((await this.memberRole(albumId, userId)) !== AlbumRole.OWNER) {
      throw new ForbiddenException(
        "Seul le propriétaire peut modifier l'album.",
      );
    }
  }

  /** Albums au format de l'app, avec le nombre de photos envoyées par chaque membre. */
  private async load(albumIds: string[], userId: string): Promise<AlbumDto[]> {
    if (albumIds.length === 0) return [];
    const [albums, counts] = await Promise.all([
      this.prisma.album.findMany({
        where: { id: { in: albumIds } },
        include: ALBUM_INCLUDE,
      }),
      this.prisma.photo.groupBy({
        by: ['albumId', 'authorId'],
        where: { albumId: { in: albumIds } },
        _count: { _all: true },
      }),
    ]);
    const photoCount = (albumId: string, authorId: string) =>
      counts.find((c) => c.albumId === albumId && c.authorId === authorId)
        ?._count._all ?? 0;

    return Promise.all(
      albums.map(async (album) => {
        const coverKey = album.coverKey ?? album.photos[0]?.displayKey ?? null;
        return {
          id: album.id,
          name: album.name,
          startDate: album.startDate,
          endDate: album.endDate,
          coverUrl: coverKey ? await this.storage.readUrl(coverKey) : null,
          /** Clé stable pour le cache d'images de l'app : l'URL signée, elle, change. */
          coverCacheKey: coverKey,
          hasCustomCover: album.coverKey !== null,
          photoCount: album._count.photos,
          myRole:
            ROLE[
              album.members.find((m) => m.userId === userId)?.role ??
                AlbumRole.MEMBER
            ],
          members: await Promise.all(
            album.members.map(async (m) => ({
              id: m.user.id,
              name: m.user.nickname,
              avatarUrl: await this.users.avatarUrlOf(m.user),
              role: ROLE[m.role],
              photoCount: photoCount(album.id, m.user.id),
            })),
          ),
        };
      }),
    );
  }
}

function assertPeriod(startDate: string, endDate: string) {
  if (endDate < startDate)
    throw new BadRequestException('La fin doit suivre le début.');
}
