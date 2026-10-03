import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Configuration Prisma 7 : chemin du schéma et URL de connexion pour les migrations. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
