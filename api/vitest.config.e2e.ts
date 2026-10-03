import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Tests de bout en bout : l'API complète sur une base Postgres dédiée (`synkup_test`), avec un
 * stockage en mémoire à la place du bucket. SWC compile les décorateurs avec leurs métadonnées,
 * dont l'injection de dépendances de Nest a besoin (esbuild ne les émet pas).
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    // Métadonnées des décorateurs (DTO, injection), chargées par Nest en temps normal.
    setupFiles: ['reflect-metadata'],
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Une seule base partagée : les fichiers de test s'exécutent l'un après l'autre.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://synkup:synkup@localhost:5432/synkup_test?schema=public',
      ALLOW_DEV_TOKENS: 'true',
      CLERK_SECRET_KEY: 'sk_test_unused',
      INVITE_BASE_URL: 'https://invite.test/join/',
      S3_ENDPOINT: 'https://storage.invalid',
      S3_REGION: 'test',
      S3_BUCKET: 'test',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'test',
    },
  },
});
