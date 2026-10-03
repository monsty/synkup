import { type INestApplication, ValidationPipe } from '@nestjs/common';

/** Version des routes : une app publiée garde l'ancienne version des mois, on ne la casse pas. */
export const API_PREFIX = 'v1';

/** Réglages communs au serveur et aux tests de bout en bout. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  // Les DTO sont validés et nettoyés : un champ inconnu est rejeté, pas ignoré.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
