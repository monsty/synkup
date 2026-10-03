import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    // Métadonnées des décorateurs (DTO, injection), chargées par Nest en temps normal.
    setupFiles: ['reflect-metadata'],
    root: './',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
