import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Variables d'environnement, vérifiées au démarrage : une variable manquante ou invalide
 * empêche le serveur de démarrer, au lieu d'échouer à la première requête qui en a besoin.
 */
class Env {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1)
  CLERK_SECRET_KEY!: string;

  /**
   * Accepte les jetons `dev:<id>:<email>` (tests, curl). Désactivé si absent, et refusé en
   * production quoi qu'il arrive.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  ALLOW_DEV_TOKENS: 'true' | 'false' = 'false';

  /**
   * Début des liens d'invitation partagés (et encodés dans les QR codes), domaine compris :
   * `https://<domaine>/join/`. Seule source du domaine public : aucune valeur par défaut.
   */
  @IsUrl({
    require_tld: false,
    protocols: ['https', 'http'],
    require_protocol: true,
  })
  INVITE_BASE_URL!: string;

  @IsString()
  @MinLength(1)
  S3_ENDPOINT!: string;

  @IsString()
  @MinLength(1)
  S3_REGION!: string;

  @IsString()
  @MinLength(1)
  S3_BUCKET!: string;

  @IsString()
  @MinLength(1)
  S3_ACCESS_KEY_ID!: string;

  @IsString()
  @MinLength(1)
  S3_SECRET_ACCESS_KEY!: string;
}

export function validateEnv(raw: Record<string, unknown>) {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const names = errors.map((e) => e.property).join(', ');
    throw new Error(
      `Configuration invalide ou incomplète : ${names}. Voir .env.example.`,
    );
  }
  if (env.NODE_ENV === 'production' && env.ALLOW_DEV_TOKENS === 'true') {
    throw new Error('ALLOW_DEV_TOKENS est interdit en production.');
  }
  return env;
}
