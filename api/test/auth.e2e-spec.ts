import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

describe('Authentification', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetDatabase(t.prisma));
  afterAll(() => t.app.close());

  it('refuse une requête sans jeton', async () => {
    await t.anonymous().get('/v1/albums').expect(401);
  });

  it('refuse un jeton illisible', async () => {
    await t
      .anonymous()
      .get('/v1/albums')
      .set('Authorization', 'Bearer abc.def.ghi')
      .expect(401);
  });

  it('refuse un en-tête qui n’est pas « Bearer »', async () => {
    await t
      .anonymous()
      .get('/v1/albums')
      .set('Authorization', 'dev:alice:a@test.dev')
      .expect(401);
  });

  it('crée le compte à la première requête', async () => {
    await t.as('alice').get('/albums').expect(200, []);
    expect(
      await t.prisma.user.findUnique({ where: { id: 'alice' } }),
    ).not.toBeNull();
  });

  it('expose /health hors préfixe de version, sans authentification', async () => {
    await t.anonymous().get('/health').expect(200, { status: 'ok' });
  });

  it('ne sert rien sans le préfixe /v1', async () => {
    await t.anonymous().get('/albums').expect(404);
  });
});
