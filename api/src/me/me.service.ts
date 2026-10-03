import { randomUUID } from 'node:crypto';

import type { MeDto, PlanId, UploadUrlDto } from '@synkup/shared';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { albumPrefix, avatarPrefix } from '../albums/media-keys.js';
import { AlbumRole, Plan } from '../generated/prisma/client.js';
import { PHOTO_QUOTA } from '../plans.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ClerkService } from '../users/clerk.service.js';
import { UsersService } from '../users/users.service.js';
import type { UpdateMeDto } from './me.dto.js';

const PLAN_ID: Record<Plan, PlanId> = {
  [Plan.FREE]: 'free',
  [Plan.PRO]: 'pro',
  [Plan.ULTRA]: 'ultra',
};

/** Le compte connecté : profil, offre, usage, et suppression. */
@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly clerk: ClerkService,
  ) {}

  async get(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Même calcul que le quota appliqué à l'envoi : photos des albums dont je suis propriétaire.
    const owned = { members: { some: { userId, role: AlbumRole.OWNER } } };
    const [photos, albums] = await Promise.all([
      this.prisma.photo.count({ where: { album: owned } }),
      this.prisma.album.count({ where: owned }),
    ]);
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: await this.users.avatarUrlOf(user),
      avatarCacheKey: user.avatarKey,
      memberSince: user.createdAt.toISOString(),
      plan: PLAN_ID[user.plan],
      usage: { photos, albums, photoQuota: PHOTO_QUOTA[user.plan] },
    };
  }

  async update(userId: string, input: UpdateMeDto): Promise<MeDto> {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (input.avatarKey) {
      const valid =
        input.avatarKey.startsWith(avatarPrefix(userId)) &&
        (await this.storage.size(input.avatarKey)) !== null;
      if (!valid)
        throw new BadRequestException(
          "Photo introuvable : l'envoi n'est pas terminé.",
        );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: input.nickname?.trim(), avatarKey: input.avatarKey },
    });
    // L'ancienne photo n'est plus utilisée nulle part.
    if (
      input.avatarKey !== undefined &&
      current.avatarKey &&
      current.avatarKey !== input.avatarKey
    ) {
      await this.storage.deleteQuietly([current.avatarKey]);
    }
    return this.get(userId);
  }

  async avatarUpload(userId: string, byteSize: number): Promise<UploadUrlDto> {
    const key = `${avatarPrefix(userId)}${randomUUID()}.jpg`;
    return {
      key,
      uploadUrl: await this.storage.uploadUrl(key, 'image/jpeg', byteSize),
    };
  }

  /**
   * Supprime le compte et tout ce qui en dépend : les albums dont il est propriétaire (avec
   * toutes leurs photos, y compris celles des autres membres), ses photos dans les albums des
   * autres, ses appartenances, sa photo de profil, puis son compte Clerk.
   */
  async remove(userId: string): Promise<void> {
    const ownedAlbums = await this.prisma.albumMember.findMany({
      where: { userId, role: AlbumRole.OWNER },
      select: { albumId: true },
    });
    const albumIds = ownedAlbums.map((m) => m.albumId);
    const elsewhere = await this.prisma.photo.findMany({
      where: { authorId: userId, albumId: { notIn: albumIds } },
      select: { storageKey: true, displayKey: true, thumbKey: true },
    });

    // La base d'abord, en une transaction : albums (cascade : photos, membres, invitations),
    // ses autres photos, puis le compte (cascade : ses appartenances restantes).
    await this.prisma.$transaction([
      this.prisma.album.deleteMany({ where: { id: { in: albumIds } } }),
      this.prisma.photo.deleteMany({ where: { authorId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    this.users.forget(userId);

    // Puis les fichiers : un échec du stockage est journalisé, pas bloquant.
    await Promise.all([
      ...albumIds.map((id) =>
        this.storage.deletePrefixQuietly(albumPrefix(id)),
      ),
      this.storage.deleteQuietly(
        elsewhere.flatMap((p) => [p.storageKey, p.displayKey, p.thumbKey]),
      ),
      this.storage.deletePrefixQuietly(avatarPrefix(userId)),
    ]);

    // Enfin Clerk. En cas d'échec, l'app peut réessayer : le compte sera recréé vide à la
    // requête suivante, puis supprimé à nouveau.
    try {
      await this.clerk.deleteUser(userId);
    } catch (error) {
      this.logger.error(
        `Compte Clerk ${userId} non supprimé : ${String(error)}`,
      );
      throw error;
    }
  }
}
