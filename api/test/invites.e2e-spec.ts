import {
  albumWith,
  createTestApp,
  resetDatabase,
  type TestApp,
} from './helpers.js';

describe('Invitations', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    t.storage.objects.clear();
  });
  afterAll(() => t.app.close());

  const linkOf = async (userId: string, albumId: string) =>
    (await t.as(userId).get(`/albums/${albumId}/invite`).expect(200)).body as {
      token: string;
      url: string;
    };

  it('donne à chaque membre le même lien actif, impossible à deviner', async () => {
    const id = await albumWith(t, 'alice', ['bob']);
    const first = await linkOf('alice', id);
    const second = await linkOf('bob', id);
    expect(second.token).toBe(first.token);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // Domaine pris dans la configuration (INVITE_BASE_URL du test).
    expect(first.url).toBe(`https://invite.test/join/${first.token}`);
  });

  it('refuse le lien à un non-membre', async () => {
    const id = await albumWith(t, 'alice');
    await t.as('mallory').get(`/albums/${id}/invite`).expect(404);
  });

  it('montre l’album à la personne invitée avant qu’elle rejoigne', async () => {
    const id = await albumWith(t, 'alice', ['bob']);
    const { token } = await linkOf('alice', id);
    const res = await t.as('carol').get(`/invites/${token}`).expect(200);
    expect(res.body).toMatchObject({
      token,
      alreadyMember: false,
      album: { id, name: 'Test', ownerName: 'alice', memberCount: 2 },
    });
    // L'aperçu ne fait pas rejoindre.
    await t.as('carol').get(`/albums/${id}`).expect(404);
  });

  it('fait rejoindre l’album comme simple membre, une seule fois', async () => {
    const id = await albumWith(t, 'alice');
    const { token } = await linkOf('alice', id);
    const res = await t
      .as('carol')
      .post(`/invites/${token}/accept`)
      .expect(201);
    expect(res.body).toMatchObject({ id, myRole: 'member' });
    await t.as('carol').post(`/invites/${token}/accept`).expect(201);
    expect(await t.prisma.albumMember.count({ where: { albumId: id } })).toBe(
      2,
    );
    const list = await t.as('carol').get('/albums').expect(200);
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([id]);
  });

  it('ne rétrograde pas le propriétaire qui ouvre son propre lien', async () => {
    const id = await albumWith(t, 'alice');
    const { token } = await linkOf('alice', id);
    const preview = await t.as('alice').get(`/invites/${token}`).expect(200);
    expect(preview.body.alreadyMember).toBe(true);
    const res = await t
      .as('alice')
      .post(`/invites/${token}/accept`)
      .expect(201);
    expect(res.body.myRole).toBe('owner');
  });

  it('laisse le propriétaire remplacer le lien : l’ancien ne marche plus', async () => {
    const id = await albumWith(t, 'alice');
    const old = await linkOf('alice', id);
    const fresh = (
      await t.as('alice').post(`/albums/${id}/invite/reset`).expect(201)
    ).body;
    expect(fresh.token).not.toBe(old.token);
    await t.as('carol').get(`/invites/${old.token}`).expect(404);
    await t.as('carol').post(`/invites/${old.token}/accept`).expect(404);
    await t.as('carol').post(`/invites/${fresh.token}/accept`).expect(201);
    expect((await linkOf('alice', id)).token).toBe(fresh.token);
  });

  it('réserve le remplacement du lien au propriétaire', async () => {
    const id = await albumWith(t, 'alice', ['bob']);
    await t.as('bob').post(`/albums/${id}/invite/reset`).expect(403);
    await t.as('mallory').post(`/albums/${id}/invite/reset`).expect(404);
  });

  it('refuse un lien expiré ou inconnu', async () => {
    const id = await albumWith(t, 'alice');
    const { token } = await linkOf('alice', id);
    await t.prisma.albumInvite.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await t.as('carol').get(`/invites/${token}`).expect(404);
    await t.as('carol').get('/invites/inexistant').expect(404);
  });

  it('demande d’être connecté pour voir ou accepter une invitation', async () => {
    const id = await albumWith(t, 'alice');
    const { token } = await linkOf('alice', id);
    await t.anonymous().get(`/v1/invites/${token}`).expect(401);
    await t.anonymous().post(`/v1/invites/${token}/accept`).expect(401);
  });

  it('supprimer l’album invalide ses liens', async () => {
    const id = await albumWith(t, 'alice');
    const { token } = await linkOf('alice', id);
    await t.as('alice').delete(`/albums/${id}`).expect(204);
    await t.as('carol').get(`/invites/${token}`).expect(404);
  });
});
