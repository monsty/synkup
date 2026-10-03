import { validateEnv } from './env.js';

const VALID = {
  DATABASE_URL: 'postgresql://localhost/db',
  CLERK_SECRET_KEY: 'sk_test',
  S3_ENDPOINT: 'https://s3.example',
  S3_REGION: 'eu',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'id',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateEnv', () => {
  it('accepte une configuration complète, jetons de dev désactivés par défaut', () => {
    const env = validateEnv(VALID);
    expect(env.ALLOW_DEV_TOKENS).toBe('false');
    expect(env.PORT).toBe(3000);
  });

  it('refuse de démarrer si une variable manque, en la nommant', () => {
    const { CLERK_SECRET_KEY: _omit, ...rest } = VALID;
    expect(() => validateEnv(rest)).toThrow(/CLERK_SECRET_KEY/);
  });

  it('interdit les jetons de dev en production', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        NODE_ENV: 'production',
        ALLOW_DEV_TOKENS: 'true',
      }),
    ).toThrow(/production/);
  });
});
