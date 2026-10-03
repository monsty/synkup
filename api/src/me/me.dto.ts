import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { MAX_BYTES } from '../albums/media-keys.js';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 24)
  nickname?: string;

  /** Clé d'une photo envoyée via `POST /me/avatar` ; `null` : revenir à celle de Clerk. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  avatarKey?: string | null;
}

export class AvatarUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES.avatar, { message: 'Image trop lourde (2 Mo maximum).' })
  byteSize!: number;
}
