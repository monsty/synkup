import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { MAX_BYTES, ORIGINAL_EXTENSIONS } from './media-keys.js';

/** Ce que le téléphone sait d'une photo avant de l'envoyer. */
export class RequestUploadDto {
  /** SHA-256 de l'originale, en hexadécimal. */
  @Matches(/^[a-f0-9]{64}$/, { message: 'Empreinte SHA-256 attendue.' })
  contentHash!: string;

  @IsIn(Object.keys(ORIGINAL_EXTENSIONS))
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  width!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  height!: number;

  @IsISO8601()
  takenAt!: string;

  /** Tailles exactes des trois versions, en octets : signées dans les URL d'envoi. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES.original, { message: 'Photo trop lourde (50 Mo maximum).' })
  byteSize!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES.display)
  displaySize!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES.thumb)
  thumbSize!: number;
}

/** Confirmation après l'envoi des trois versions. */
export class CompletePhotoDto extends RequestUploadDto {
  @IsUUID()
  photoId!: string;
}

export class DeletePhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}

/** Couverture choisie à la main : sa taille est signée dans l'URL d'envoi. */
export class CoverUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES.cover, { message: 'Image trop lourde (5 Mo maximum).' })
  byteSize!: number;
}
