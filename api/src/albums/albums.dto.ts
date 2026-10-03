import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Date attendue au format AAAA-MM-JJ.';

export class CreateAlbumDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @Matches(DATE_KEY, { message: DATE_MESSAGE })
  startDate!: string;

  @Matches(DATE_KEY, { message: DATE_MESSAGE })
  endDate!: string;
}

export class UpdateAlbumDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @IsOptional()
  @Matches(DATE_KEY, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_KEY, { message: DATE_MESSAGE })
  endDate?: string;

  /** Clé d'une couverture envoyée via `POST /albums/:id/cover` ; `null` : la dernière photo. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  coverKey?: string | null;
}

export class UpdateMemberDto {
  @IsIn(['owner', 'member'])
  role!: 'owner' | 'member';
}
