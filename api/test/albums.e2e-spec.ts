import {
  albumWith,
  createTestApp,
  PERIOD,
  resetDatabase,
  uploadPhoto,
  type TestApp,
} from './helpers.js';

describe('Albums', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.storage.objects.clear();
  });
  afterAll(() => t.app.close());

  describe('création', () => {
    it('fait du créateur le propriétaire et le seul membre', async () => {
      const res = await t
        .as('alice')
        .post('/albums', { name: ' Lisbonne ', ...PERIOD })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Lisbonne',
        myRole: 'owner',
        photoCount: 0,
      });
      expect(res.body.members).toEqual([
        expect.objectContaining({ id: 'alice', role: 'owner' }),
      ]);
    });

    it('refuse une fin avant le début', async () => {
      await t
        .as('alice')
        .post('/albums', {
          name: 'X',
          startDate: '2026-10-05',
          endDate: '2026-10-01',
        })
        .expect(400);
    });

    it('refuse un champ inconnu', async () => {
      await t
        .as('alice')
        .post('/albums', { name: 'X', ...PERIOD, ownerId: 'bob' })
        .expect(400);
    });

    it('refuse un nom vide ou trop long', async () => {
      await t
        .as('alice')
        .post('/albums', { name: '', ...PERIOD })
        .expect(400);
      await t
        .as('alice')
        .post('/albums', { name: 'x'.repeat(41), ...PERIOD })
        .expect(400);
    });
  });

  describe('lecture', () => {
    it('ne liste que les albums dont on est membre', async () => {
      await albumWith(t, 'alice');
      const shared = await albumWith(t, 'bob', ['alice']);
      await albumWith(t, 'carol');
      const res = await t.as('alice').get('/albums').expect(200);
      expect(res.body.map((a: { id: string }) => a.id)).toHaveLength(2);
      expect(res.body.find((a: { id: string }) => a.id === shared).myRole).toBe(
        'member',
      );
    });

    it('répond 404 à un non-membre, sans révéler l’album', async () => {
      const id = await albumWith(t, 'alice');
      await t.as('mallory').get(`/albums/${id}`).expect(404);
      await t.as('mallory').get(`/albums/${id}/photos`).expect(404);
    });
  });

  describe('modification et suppression', () => {
    it('autorise le propriétaire', async () => {
      const id = await albumWith(t, 'alice');
      const res = await t
        .as('alice')
        .patch(`/albums/${id}`, { name: 'Renommé' })
        .expect(200);
      expect(res.body.name).toBe('Renommé');
      await t.as('alice').delete(`/albums/${id}`).expect(204);
      await t.as('alice').get(`/albums/${id}`).expect(404);
    });

    it('refuse un simple membre (403) et un non-membre (404)', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      await t.as('bob').patch(`/albums/${id}`, { name: 'Pirate' }).expect(403);
      await t.as('bob').delete(`/albums/${id}`).expect(403);
      await t
        .as('mallory')
        .patch(`/albums/${id}`, { name: 'Pirate' })
        .expect(404);
      await t.as('mallory').delete(`/albums/${id}`).expect(404);
    });

    it('vérifie la période avec les dates déjà en place', async () => {
      const id = await albumWith(t, 'alice');
      await t
        .as('alice')
        .patch(`/albums/${id}`, { endDate: '2026-09-01' })
        .expect(400);
    });

    it('refuse une couverture qui n’est pas dans le dossier de l’album', async () => {
      const id = await albumWith(t, 'alice');
      const other = await albumWith(t, 'bob');
      const cover = await t
        .as('bob')
        .post(`/albums/${other}/cover`, { byteSize: 1000 })
        .expect(201);
      t.storage.upload(cover.body.uploadUrl);
      await t
        .as('alice')
        .patch(`/albums/${id}`, { coverKey: cover.body.key })
        .expect(400);
    });

    it('remplace la couverture et efface l’ancienne', async () => {
      const id = await albumWith(t, 'alice');
      const first = await t
        .as('alice')
        .post(`/albums/${id}/cover`, { byteSize: 1000 })
        .expect(201);
      t.storage.upload(first.body.uploadUrl);
      await t
        .as('alice')
        .patch(`/albums/${id}`, { coverKey: first.body.key })
        .expect(200);
      const second = await t
        .as('alice')
        .post(`/albums/${id}/cover`, { byteSize: 1000 })
        .expect(201);
      t.storage.upload(second.body.uploadUrl);
      const res = await t
        .as('alice')
        .patch(`/albums/${id}`, { coverKey: second.body.key })
        .expect(200);
      expect(res.body.hasCustomCover).toBe(true);
      expect(t.storage.keys()).toContain(second.body.key);
      expect(t.storage.keys()).not.toContain(first.body.key);
    });

    it('refuse une couverture trop lourde', async () => {
      const id = await albumWith(t, 'alice');
      await t
        .as('alice')
        .post(`/albums/${id}/cover`, { byteSize: 6 * 1024 * 1024 })
        .expect(400);
    });
  });

  describe('membres', () => {
    it('transfère la propriété : l’ancien propriétaire devient membre', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const res = await t
        .as('alice')
        .patch(`/albums/${id}/members/bob`, { role: 'owner' })
        .expect(200);
      expect(res.body.myRole).toBe('member');
      const owners = await t.prisma.albumMember.findMany({
        where: { albumId: id, role: 'OWNER' },
      });
      expect(owners.map((m) => m.userId)).toEqual(['bob']);
    });

    it('réserve la gestion des membres au propriétaire', async () => {
      const id = await albumWith(t, 'alice', ['bob', 'carol']);
      await t
        .as('bob')
        .patch(`/albums/${id}/members/carol`, { role: 'owner' })
        .expect(403);
      await t.as('bob').delete(`/albums/${id}/members/carol`).expect(403);
    });

    it('retire un membre, qui perd l’accès', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      await t.as('alice').delete(`/albums/${id}/members/bob`).expect(200);
      await t.as('bob').get(`/albums/${id}`).expect(404);
    });

    it('laisse un membre quitter l’album, ses photos y restent', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const photo = await uploadPhoto(t, 'bob', id);
      await t.as('bob').post(`/albums/${id}/leave`).expect(204);
      await t.as('bob').get(`/albums/${id}`).expect(404);
      const album = await t.as('alice').get(`/albums/${id}`).expect(200);
      expect(album.body.members.map((m: { id: string }) => m.id)).toEqual([
        'alice',
      ]);
      const photos = await t
        .as('alice')
        .get(`/albums/${id}/photos`)
        .expect(200);
      expect(photos.body.map((p: { id: string }) => p.id)).toEqual([photo.id]);
    });

    it('interdit au propriétaire de quitter l’album, et à un non-membre d’essayer', async () => {
      const id = await albumWith(t, 'alice');
      await t.as('alice').post(`/albums/${id}/leave`).expect(400);
      await t.as('mallory').post(`/albums/${id}/leave`).expect(404);
    });

    it('interdit au propriétaire de se retirer', async () => {
      const id = await albumWith(t, 'alice');
      await t.as('alice').delete(`/albums/${id}/members/alice`).expect(400);
    });
  });
});
