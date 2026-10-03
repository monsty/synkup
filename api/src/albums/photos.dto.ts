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
  Min,
} from 'class-validator';

import { ORIGINAL_EXTENSIONS } from './media-keys.js';

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
