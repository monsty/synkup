import {
  albumWith,
  createTestApp,
  resetDatabase,
  uploadPhoto,
  type TestApp,
} from './helpers.js';

describe('Mon compte', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.storage.objects.clear();
    t.clerkDeleted.length = 0;
  });
  afterAll(() => t.app.close());

  describe('profil et usage', () => {
    it('renvoie le profil, l’offre gratuite et un usage vide', async () => {
      const res = await t.as('alice').get('/me').expect(200);
      expect(res.body).toMatchObject({
        id: 'alice',
        email: 'alice@test.dev',
        nickname: 'alice',
        avatarUrl: null,
        plan: 'free',
        usage: { photos: 0, albums: 0, photoQuota: 1000 },
      });
      expect(new Date(res.body.memberSince).getTime()).not.toBeNaN();
    });

    it('compte l’usage comme le quota : seulement les albums dont je suis propriétaire', async () => {
      const mine = await albumWith(t, 'alice', ['bob']);
      const theirs = await albumWith(t, 'bob', ['alice']);
      await uploadPhoto(t, 'alice', mine);
      await uploadPhoto(t, 'bob', mine);
      await uploadPhoto(t, 'alice', theirs);
      const res = await t.as('alice').get('/me').expect(200);
      expect(res.body.usage).toEqual({
        photos: 2,
        albums: 1,
        photoQuota: 1000,
      });
    });

    it('modifie le surnom, et les autres membres le voient', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      await t.as('alice').patch('/me', { nickname: '  Alice  ' }).expect(200);
      const album = await t.as('bob').get(`/albums/${id}`).expect(200);
      expect(
        album.body.members.find((m: { id: string }) => m.id === 'alice').name,
      ).toBe('Alice');
    });

    it('refuse un surnom vide, trop long, ou un changement d’email', async () => {
      await t.as('alice').patch('/me', { nickname: '' }).expect(400);
      await t
        .as('alice')
        .patch('/me', { nickname: 'x'.repeat(25) })
        .expect(400);
      await t
        .as('alice')
        .patch('/me', { email: 'pirate@test.dev' })
        .expect(400);
    });
  });

  describe('photo de profil', () => {
    it('envoie, applique, puis remplace la photo en effaçant l’ancienne', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const first = (
        await t.as('alice').post('/me/avatar', { byteSize: 1000 }).expect(201)
      ).body;
      t.storage.upload(first.uploadUrl);
      const me = await t
        .as('alice')
        .patch('/me', { avatarKey: first.key })
        .expect(200);
      expect(me.body.avatarUrl).toBe(
        `fake://get/${encodeURIComponent(first.key)}`,
      );
      expect(me.body.avatarCacheKey).toBe(first.key);
      // Visible des autres membres.
      const album = await t.as('bob').get(`/albums/${id}`).expect(200);
      expect(
        album.body.members.find((m: { id: string }) => m.id === 'alice')
          .avatarUrl,
      ).toBe(me.body.avatarUrl);

      const second = (
        await t.as('alice').post('/me/avatar', { byteSize: 1000 }).expect(201)
      ).body;
      t.storage.upload(second.uploadUrl);
      await t.as('alice').patch('/me', { avatarKey: second.key }).expect(200);
      expect(t.storage.keys()).toEqual([second.key]);

      await t.as('alice').patch('/me', { avatarKey: null }).expect(200);
      expect(t.storage.keys()).toEqual([]);
    });

    it('refuse la photo d’un autre utilisateur ou une photo pas encore envoyée', async () => {
      const bob = (
        await t.as('bob').post('/me/avatar', { byteSize: 1000 }).expect(201)
      ).body;
      t.storage.upload(bob.uploadUrl);
      await t.as('alice').patch('/me', { avatarKey: bob.key }).expect(400);
      const pending = (
        await t.as('alice').post('/me/avatar', { byteSize: 1000 }).expect(201)
      ).body;
      await t.as('alice').patch('/me', { avatarKey: pending.key }).expect(400);
    });

    it('refuse une photo trop lourde', async () => {
      await t
        .as('alice')
        .post('/me/avatar', { byteSize: 3 * 1024 * 1024 })
        .expect(400);
    });
  });

  describe('suppression du compte', () => {
    it('supprime ses albums (photos des autres comprises), ses photos ailleurs et son compte', async () => {
      const mine = await albumWith(t, 'alice', ['bob']);
      const theirs = await albumWith(t, 'bob', ['alice']);
      await uploadPhoto(t, 'bob', mine);
      await uploadPhoto(t, 'alice', theirs);
      const bobsOwn = await uploadPhoto(t, 'bob', theirs);
      const avatar = (
        await t.as('alice').post('/me/avatar', { byteSize: 1000 }).expect(201)
      ).body;
      t.storage.upload(avatar.uploadUrl);
      await t.as('alice').patch('/me', { avatarKey: avatar.key }).expect(200);

      await t.as('alice').delete('/me').expect(204);

      // Son album a disparu pour tout le monde, l'album de Bob reste avec la seule photo de Bob.
      await t.as('bob').get(`/albums/${mine}`).expect(404);
      const photos = await t
        .as('bob')
        .get(`/albums/${theirs}/photos`)
        .expect(200);
      expect(photos.body.map((p: { id: string }) => p.id)).toEqual([
        bobsOwn.id,
      ]);
      const album = await t.as('bob').get(`/albums/${theirs}`).expect(200);
      expect(album.body.members.map((m: { id: string }) => m.id)).toEqual([
        'bob',
      ]);

      // Plus rien d'Alice dans la base ni dans le stockage, et son compte Clerk est supprimé.
      expect(
        await t.prisma.user.findUnique({ where: { id: 'alice' } }),
      ).toBeNull();
      expect(
        t.storage
          .keys()
          .every((k) => k.startsWith(`albums/${theirs}/photos/${bobsOwn.id}/`)),
      ).toBe(true);
      expect(t.storage.keys()).toHaveLength(3);
      expect(t.clerkDeleted).toEqual(['alice']);
    });

    it('ne touche pas aux autres comptes', async () => {
      await albumWith(t, 'bob');
      await t.as('alice').get('/me').expect(200);
      await t.as('alice').delete('/me').expect(204);
      const bob = await t.as('bob').get('/albums').expect(200);
      expect(bob.body).toHaveLength(1);
    });
  });
});
