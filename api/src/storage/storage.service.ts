import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Durée de validité d'une URL d'envoi : le temps de préparer et d'envoyer une photo. */
const UPLOAD_TTL_S = 15 * 60;
/**
 * URL de lecture stables par tranche de 24 h : signées à la date du début de la tranche et
 * valables 48 h, elles restent identiques toute la journée (le cache d'images de l'app se base
 * sur l'URL) et toujours valides au moins 24 h après réception. Un lien qui fuite meurt en 48 h.
 */
const READ_WINDOW_MS = 24 * 60 * 60 * 1000;
const READ_TTL_S = 48 * 60 * 60;

/**
 * Bucket des médias (S3 compatible : Backblaze B2 aujourd'hui). L'API ne voit jamais les
 * octets : elle signe des URL d'envoi et de lecture, vérifie qu'un objet existe et supprime.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.s3 = new S3Client({
      endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
      region: config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * URL d'envoi direct depuis le téléphone. Type MIME et taille exacte sont figés dans la
   * signature : le stockage refuse un fichier différent de ce qui a été annoncé.
   */
  uploadUrl(
    key: string,
    contentType: string,
    byteSize: number,
  ): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
      }),
      { expiresIn: UPLOAD_TTL_S },
    );
  }

  readUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: READ_TTL_S,
        signingDate: new Date(
          Math.floor(Date.now() / READ_WINDOW_MS) * READ_WINDOW_MS,
        ),
      },
    );
  }

  /** Taille de l'objet en octets, ou `null` s'il n'existe pas. */
  async size(key: string): Promise<number | null> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return head.ContentLength ?? 0;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  async delete(keys: string[]): Promise<void> {
    // DeleteObjects accepte 1 000 clés par appel.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  /** Supprime tout ce qui est rangé sous un préfixe (un album entier, par exemple). */
  async deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : []));
      if (keys.length > 0) await this.delete(keys);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  /**
   * Après une suppression en base : la base fait foi, un échec du stockage ne doit pas faire
   * échouer la requête. Les fichiers restés orphelins sont signalés dans les logs (et seront
   * repris par le ménage périodique).
   */
  async deleteQuietly(keys: string[]): Promise<void> {
    try {
      await this.delete(keys);
    } catch (error) {
      this.logger.error(
        `Fichiers orphelins (${keys.length}) : ${keys.join(', ')} — ${String(error)}`,
      );
    }
  }

  async deletePrefixQuietly(prefix: string): Promise<void> {
    try {
      await this.deletePrefix(prefix);
    } catch (error) {
      this.logger.error(`Dossier orphelin : ${prefix} — ${String(error)}`);
    }
  }
}
