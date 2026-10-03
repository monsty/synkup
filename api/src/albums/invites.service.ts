import { randomBytes } from 'node:crypto';

import type { AlbumDto, InviteDto, InvitePreviewDto } from '@synkup/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AlbumRole, type AlbumInvite } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AlbumsService } from './albums.service.js';

/** Avatars montrés dans l'aperçu d'une invitation. */
const PREVIEW_MEMBERS = 5;

/**
 * Invitations par lien (et QR code). Un album a un seul lien actif à la fois : tout membre peut
 * le partager, le propriétaire peut le remplacer (l'ancien cesse alors de fonctionner).
 * Le jeton est aléatoire (128 bits) : impossible à deviner, il suffit à ouvrir l'album.
 */
@Injectable()
export class InvitesService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly albums: AlbumsService,
    config: ConfigService,
  ) {
    const base = config.get<string>(
      'INVITE_BASE_URL',
      'https://synkup.app/join/',
    );
    this.baseUrl = base.endsWith('/') ? base : `${base}/`;
  }

  /** Lien actif de l'album, créé au premier partage. Réservé aux membres. */
  async current(albumId: string, userId: string): Promise<InviteDto> {
    await this.albums.memberRole(albumId, userId);
    const active = await this.prisma.albumInvite.findFirst({
      where: { albumId, ...ACTIVE() },
      orderBy: { createdAt: 'desc' },
    });
    return this.toDto(active ?? (await this.create(albumId)));
  }

  /** Remplace le lien : l'ancien ne fonctionne plus. Réservé au propriétaire. */
  async reset(albumId: string, userId: string): Promise<InviteDto> {
    await this.albums.assertOwner(albumId, userId);
    await this.prisma.albumInvite.updateMany({
      where: { albumId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.toDto(await this.create(albumId));
  }

  /** Aperçu de l'album avant de rejoindre : nom, période, propriétaire, membres. */
  async preview(token: string, userId: string): Promise<InvitePreviewDto> {
    const invite = await this.findActive(token);
    const album = await this.prisma.album.findUniqueOrThrow({
      where: { id: invite.albumId },
      include: {
        members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
        photos: {
          orderBy: { takenAt: 'desc' },
          take: 1,
          select: { displayKey: true },
        },
      },
    });
    const owner = album.members.find((m) => m.role === AlbumRole.OWNER);
    const coverKey = album.coverKey ?? album.photos[0]?.displayKey ?? null;
    return {
      token,
      alreadyMember: album.members.some((m) => m.userId === userId),
      album: {
        id: album.id,
        name: album.name,
        startDate: album.startDate,
        endDate: album.endDate,
        coverUrl: coverKey ? await this.storage.readUrl(coverKey) : null,
        coverCacheKey: coverKey,
        ownerName: owner?.user.nickname ?? '',
        memberCount: album.members.length,
        members: album.members.slice(0, PREVIEW_MEMBERS).map((m) => ({
          id: m.user.id,
          name: m.user.nickname,
          avatarUrl: m.user.avatarUrl,
        })),
      },
    };
  }

  /** Rejoint l'album. Sans effet si on en fait déjà partie. */
  async accept(token: string, userId: string): Promise<AlbumDto> {
    const invite = await this.findActive(token);
    await this.prisma.albumMember.createMany({
      data: [{ albumId: invite.albumId, userId, role: AlbumRole.MEMBER }],
      skipDuplicates: true,
    });
    return this.albums.getForUser(invite.albumId, userId);
  }

  private async findActive(token: string): Promise<AlbumInvite> {
    const invite = await this.prisma.albumInvite.findFirst({
      where: { token, ...ACTIVE() },
    });
    if (!invite)
      throw new NotFoundException("Ce lien d'invitation n'est plus valide.");
    return invite;
  }

  private create(albumId: string) {
    return this.prisma.albumInvite.create({
      data: { albumId, token: randomBytes(16).toString('base64url') },
    });
  }

  private toDto(invite: AlbumInvite): InviteDto {
    return { token: invite.token, url: `${this.baseUrl}${invite.token}` };
  }
}

/** Invitation utilisable : ni révoquée, ni expirée. */
function ACTIVE() {
  return {
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}
