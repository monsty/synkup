import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AlbumRole, Prisma } from '../generated/prisma/client.js';
import { PHOTO_QUOTA } from '../plans.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AlbumsService } from './albums.service.js';
import { photoKey, type PhotoVariant } from './media-keys.js';
import type { CompletePhotoDto, RequestUploadDto } from './photos.dto.js';

const VARIANTS: PhotoVariant[] = ['original', 'display', 'thumb'];

/**
 * Photos d'un album. Envoi en deux temps, sans que les octets passent par l'API :
 * 1. le téléphone demande des URL d'envoi (doublon et quota vérifiés avant tout transfert) ;
 * 2. il envoie les trois versions au bucket, puis confirme : la photo existe alors en base.
 */
@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly albums: AlbumsService,
  ) {}

  async requestUpload(
    albumId: string,
    userId: string,
    input: RequestUploadDto,
  ) {
    await this.albums.memberRole(albumId, userId);
    await this.assertNotDuplicate(albumId, input.contentHash);
    await this.assertQuota(albumId);

    const photoId = randomUUID();
    const sizes = declaredSizes(input);
    const [original, display, thumb] = await Promise.all(
      VARIANTS.map((variant, i) =>
        this.storage.uploadUrl(
          photoKey(albumId, photoId, variant, input.contentType),
          variant === 'original' ? input.contentType : 'image/jpeg',
          sizes[i],
        ),
      ),
    );
    return { photoId, uploads: { original, display, thumb } };
  }

  async complete(albumId: string, userId: string, input: CompletePhotoDto) {
    await this.albums.memberRole(albumId, userId);
    const [storageKey, displayKey, thumbKey] = VARIANTS.map((variant) =>
      photoKey(albumId, input.photoId, variant, input.contentType),
    );
    const sizes = await Promise.all(
      [storageKey, displayKey, thumbKey].map((k) => this.storage.size(k)),
    );
    if (sizes.some((size) => size === null)) {
      throw new BadRequestException(
        'Envoi incomplet : une version de la photo manque.',
      );
    }
    // Le stockage applique déjà la taille signée ; on revérifie avant d'inscrire la photo.
    const expected = declaredSizes(input);
    if (sizes.some((size, i) => size !== expected[i])) {
      await this.storage.deleteQuietly([storageKey, displayKey, thumbKey]);
      throw new BadRequestException(
        "Envoi incomplet : la taille d'un fichier ne correspond pas.",
      );
    }

    try {
      const photo = await this.prisma.photo.create({
        data: {
          id: input.photoId,
          albumId,
          authorId: userId,
          storageKey,
          displayKey,
          thumbKey,
          contentType: input.contentType,
          byteSize: sizes[0] ?? 0,
          contentHash: input.contentHash,
          width: input.width,
          height: input.height,
          takenAt: new Date(input.takenAt),
        },
        include: { author: true },
      });
      return this.toDto(photo);
    } catch (error) {
      // Envoyée deux fois en parallèle : la base tranche, on ne garde pas les fichiers en trop.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.storage.deleteQuietly([storageKey, displayKey, thumbKey]);
        throw duplicate();
      }
      throw error;
    }
  }

  /** Photos de l'album, les plus récentes d'abord, avec des URL de lecture signées. */
  async list(albumId: string, userId: string) {
    await this.albums.memberRole(albumId, userId);
    const photos = await this.prisma.photo.findMany({
      where: { albumId },
      orderBy: { takenAt: 'desc' },
      include: { author: true },
    });
    return Promise.all(photos.map((photo) => this.toDto(photo)));
  }

  /** Chacun supprime ses photos ; le propriétaire peut supprimer toutes celles de l'album. */
  async remove(albumId: string, userId: string, ids: string[]) {
    const role = await this.albums.memberRole(albumId, userId);
    const photos = await this.prisma.photo.findMany({
      where: { albumId, id: { in: ids } },
    });
    if (role !== AlbumRole.OWNER && photos.some((p) => p.authorId !== userId)) {
      throw new ForbiddenException(
        'Tu ne peux supprimer que tes propres photos.',
      );
    }
    await this.prisma.photo.deleteMany({
      where: { id: { in: photos.map((p) => p.id) } },
    });
    await this.storage.deleteQuietly(
      photos.flatMap((p) => [p.storageKey, p.displayKey, p.thumbKey]),
    );
  }

  private async assertNotDuplicate(albumId: string, contentHash: string) {
    const existing = await this.prisma.photo.findUnique({
      where: { albumId_contentHash: { albumId, contentHash } },
      select: { id: true },
    });
    if (existing) throw duplicate();
  }

  /** Le quota est celui du propriétaire de l'album : ses albums, toutes photos confondues. */
  private async assertQuota(albumId: string) {
    const owner = await this.prisma.albumMember.findFirstOrThrow({
      where: { albumId, role: AlbumRole.OWNER },
      include: { user: { select: { plan: true } } },
    });
    const used = await this.prisma.photo.count({
      where: {
        album: {
          members: { some: { userId: owner.userId, role: AlbumRole.OWNER } },
        },
      },
    });
    if (used >= PHOTO_QUOTA[owner.user.plan]) {
      throw new ForbiddenException({
        code: 'quota_reached',
        message:
          "L'album est plein : le propriétaire a atteint la limite de son offre.",
      });
    }
  }

  private async toDto(
    photo: Prisma.PhotoGetPayload<{ include: { author: true } }>,
  ) {
    const [originalUrl, displayUrl, thumbUrl] = await Promise.all(
      [photo.storageKey, photo.displayKey, photo.thumbKey].map((k) =>
        this.storage.readUrl(k),
      ),
    );
    return {
      id: photo.id,
      width: photo.width,
      height: photo.height,
      takenAt: photo.takenAt,
      authorId: photo.authorId,
      authorName: photo.author.nickname,
      originalUrl,
      displayUrl,
      thumbUrl,
    };
  }
}

/** Tailles annoncées, dans l'ordre de `VARIANTS`. */
function declaredSizes(input: RequestUploadDto): number[] {
  return [input.byteSize, input.displaySize, input.thumbSize];
}

function duplicate() {
  return new ConflictException({
    code: 'duplicate',
    message: "Cette photo est déjà dans l'album.",
  });
}
