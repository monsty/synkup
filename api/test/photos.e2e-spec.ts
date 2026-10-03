import {
  albumWith,
  createTestApp,
  photoMeta,
  resetDatabase,
  uploadPhoto,
  type TestApp,
} from './helpers.js';

describe('Photos', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.storage.objects.clear();
  });
  afterAll(() => t.app.close());

  describe('envoi', () => {
    it('ajoute la photo après le parcours complet, rangée sous l’album', async () => {
      const id = await albumWith(t, 'alice');
      await uploadPhoto(t, 'alice', id);
      const list = await t.as('alice').get(`/albums/${id}/photos`).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        authorId: 'alice',
        width: 4032,
        height: 3024,
      });
      expect(
        t.storage.keys().every((k) => k.startsWith(`albums/${id}/photos/`)),
      ).toBe(true);
      const album = await t.as('alice').get(`/albums/${id}`).expect(200);
      expect(album.body.photoCount).toBe(1);
    });

    it('n’ajoute rien tant que les fichiers ne sont pas dans le stockage', async () => {
      const id = await albumWith(t, 'alice');
      const meta = photoMeta();
      const urls = await t
        .as('alice')
        .post(`/albums/${id}/photos/uploads`, meta)
        .expect(201);
      await t
        .as('alice')
        .post(`/albums/${id}/photos`, { ...meta, photoId: urls.body.photoId })
        .expect(400);
    });

    it('refuse un fichier dont la taille ne correspond pas à celle annoncée', async () => {
      const id = await albumWith(t, 'alice');
      const meta = photoMeta();
      const urls = await t
        .as('alice')
        .post(`/albums/${id}/photos/uploads`, meta)
        .expect(201);
      for (const url of Object.values<string>(urls.body.uploads))
        t.storage.upload(url);
      // Fichier remplacé derrière notre dos par un plus gros.
      const original = t.storage.keys().find((k) => k.includes('/original.'))!;
      t.storage.objects.set(original, 999_999_999);
      await t
        .as('alice')
        .post(`/albums/${id}/photos`, { ...meta, photoId: urls.body.photoId })
        .expect(400);
      expect(t.storage.keys()).toEqual([]);
    });

    it('refuse une photo trop lourde dès la demande', async () => {
      const id = await albumWith(t, 'alice');
      await t
        .as('alice')
        .post(
          `/albums/${id}/photos/uploads`,
          photoMeta({ byteSize: 51 * 1024 * 1024 }),
        )
        .expect(400);
    });

    it('refuse un type de fichier non pris en charge', async () => {
      const id = await albumWith(t, 'alice');
      await t
        .as('alice')
        .post(
          `/albums/${id}/photos/uploads`,
          photoMeta({ contentType: 'video/mp4' }),
        )
        .expect(400);
    });

    it('signale un doublon avant tout transfert', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const meta = photoMeta();
      await uploadPhoto(t, 'alice', id, meta);
      const res = await t
        .as('bob')
        .post(`/albums/${id}/photos/uploads`, meta)
        .expect(409);
      expect(res.body.code).toBe('duplicate');
    });

    it('refuse l’envoi à un non-membre', async () => {
      const id = await albumWith(t, 'alice');
      await t
        .as('mallory')
        .post(`/albums/${id}/photos/uploads`, photoMeta())
        .expect(404);
    });

    it('applique le quota du propriétaire, même quand c’est un membre qui envoie', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const first = await uploadPhoto(t, 'alice', id);
      const photo = await t.prisma.photo.findUniqueOrThrow({
        where: { id: first.id },
      });
      // Remplit l'offre gratuite (1 000 photos) sans passer par l'API.
      await t.prisma.photo.createMany({
        data: Array.from({ length: 999 }, (_, i) => ({
          ...photo,
          id: `filler-${i}`,
          storageKey: `filler-${i}`,
          contentHash: `filler-${i}`,
        })),
      });
      const res = await t
        .as('bob')
        .post(`/albums/${id}/photos/uploads`, photoMeta())
        .expect(403);
      expect(res.body.code).toBe('quota_reached');
    });
  });

  describe('suppression', () => {
    it('laisse chacun supprimer ses photos, et efface les fichiers', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const photo = await uploadPhoto(t, 'bob', id);
      await t
        .as('bob')
        .post(`/albums/${id}/photos/delete`, { ids: [photo.id] })
        .expect(204);
      expect(t.storage.keys()).toEqual([]);
    });

    it('interdit à un membre de supprimer la photo d’un autre', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const photo = await uploadPhoto(t, 'alice', id);
      await t
        .as('bob')
        .post(`/albums/${id}/photos/delete`, { ids: [photo.id] })
        .expect(403);
      expect(await t.prisma.photo.count()).toBe(1);
    });

    it('laisse le propriétaire supprimer n’importe quelle photo', async () => {
      const id = await albumWith(t, 'alice', ['bob']);
      const photo = await uploadPhoto(t, 'bob', id);
      await t
        .as('alice')
        .post(`/albums/${id}/photos/delete`, { ids: [photo.id] })
        .expect(204);
      expect(await t.prisma.photo.count()).toBe(0);
    });

    it('ignore les photos d’un autre album glissées dans la liste', async () => {
      const mine = await albumWith(t, 'alice');
      const other = await albumWith(t, 'bob');
      const photo = await uploadPhoto(t, 'bob', other);
      await t
        .as('alice')
        .post(`/albums/${mine}/photos/delete`, { ids: [photo.id] })
        .expect(204);
      expect(await t.prisma.photo.count()).toBe(1);
    });

    it('supprimer l’album efface toutes ses photos et leurs fichiers', async () => {
      const id = await albumWith(t, 'alice');
      await uploadPhoto(t, 'alice', id);
      await uploadPhoto(t, 'alice', id);
      await t.as('alice').delete(`/albums/${id}`).expect(204);
      expect(await t.prisma.photo.count()).toBe(0);
      expect(t.storage.keys()).toEqual([]);
    });
  });
});
