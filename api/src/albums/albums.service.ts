import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Albums de l'utilisateur, avec membres, nombre de photos et couverture.
   * Tri : en cours, à venir, terminés, à la charge du client (il connaît « aujourd'hui »).
   */
  async listForUser(userId: string) {
    const memberships = await this.prisma.albumMember.findMany({
      where: { userId },
      include: {
        album: {
          include: {
            members: { include: { user: true } },
            _count: { select: { photos: true } },
            photos: { orderBy: { takenAt: 'desc' }, take: 1, select: { storageKey: true } },
          },
        },
      },
    });

    return memberships.map(({ album, role }) => ({
      id: album.id,
      name: album.name,
      startDate: album.startDate,
      endDate: album.endDate,
      coverUrl: album.coverUrl ?? album.photos[0]?.storageKey ?? null,
      hasCustomCover: album.coverUrl !== null,
      photoCount: album._count.photos,
      myRole: role,
      members: album.members.map((m) => ({
        id: m.user.id,
        name: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      })),
    }));
  }
}
