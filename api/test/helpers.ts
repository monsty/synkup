import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/setup.js';
import { StorageService } from '../src/storage/storage.service.js';
import { ClerkService } from '../src/users/clerk.service.js';
import { FakeStorage } from './fake-storage.js';

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  storage: FakeStorage;
  /** Comptes supprimés « chez Clerk » pendant le test. */
  clerkDeleted: string[];
  /** Requêtes authentifiées en tant que `userId` (jeton de dev). */
  as: (userId: string) => ReturnType<typeof agentFor>;
  /** Requêtes sans jeton. */
  anonymous: () => ReturnType<typeof request>;
};

function agentFor(app: INestApplication, userId: string) {
  const auth = { Authorization: `Bearer dev:${userId}:${userId}@test.dev` };
  const server = app.getHttpServer();
  return {
    get: (path: string) => request(server).get(`/v1${path}`).set(auth),
    post: (path: string, body?: object) =>
      request(server).post(`/v1${path}`).set(auth).send(body),
    patch: (path: string, body?: object) =>
      request(server).patch(`/v1${path}`).set(auth).send(body),
    delete: (path: string) => request(server).delete(`/v1${path}`).set(auth),
  };
}

export async function createTestApp(): Promise<TestApp> {
  const storage = new FakeStorage();
  const clerkDeleted: string[] = [];
  // Les tests n'appellent jamais Clerk : comptes créés par jeton de dev, suppressions notées.
  const clerk = {
    getProfile: async () => ({ email: null, firstName: null, imageUrl: null }),
    deleteUser: async (id: string) => {
      clerkDeleted.push(id);
    },
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storage)
    .overrideProvider(ClerkService)
    .useValue(clerk)
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    storage,
    clerkDeleted,
    as: (userId) => agentFor(app, userId),
    anonymous: () => request(app.getHttpServer()),
  };
}

/** Base vide entre deux tests. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AlbumInvite", "Photo", "AlbumMember", "Album", "User" RESTART IDENTITY CASCADE',
  );
}

export const PERIOD = { startDate: '2026-10-01', endDate: '2026-10-05' };

/** Album créé par `owner`, avec `members` ajoutés directement en base (pas encore d'invitations). */
export async function albumWith(
  t: TestApp,
  owner: string,
  members: string[] = [],
) {
  const res = await t
    .as(owner)
    .post('/albums', { name: 'Test', ...PERIOD })
    .expect(201);
  for (const id of members) {
    await t.prisma.user.upsert({
      where: { id },
      update: {},
      create: { id, email: `${id}@test.dev`, nickname: id },
    });
    await t.prisma.albumMember.create({
      data: { albumId: res.body.id, userId: id },
    });
  }
  return res.body.id as string;
}

let hashCounter = 0;

/** Métadonnées d'une photo, avec une empreinte différente à chaque appel. */
export function photoMeta(overrides: Record<string, unknown> = {}) {
  hashCounter += 1;
  return {
    contentHash: hashCounter.toString(16).padStart(64, '0'),
    contentType: 'image/heic',
    width: 4032,
    height: 3024,
    takenAt: '2026-10-02T10:00:00.000Z',
    byteSize: 3_000_000,
    displaySize: 400_000,
    thumbSize: 50_000,
    ...overrides,
  };
}

/** Parcours complet d'envoi : URL, fichiers dans le stockage, confirmation. Renvoie la photo. */
export async function uploadPhoto(
  t: TestApp,
  userId: string,
  albumId: string,
  meta = photoMeta(),
) {
  const urls = await t
    .as(userId)
    .post(`/albums/${albumId}/photos/uploads`, meta)
    .expect(201);
  for (const url of Object.values<string>(urls.body.uploads))
    t.storage.upload(url);
  const done = await t
    .as(userId)
    .post(`/albums/${albumId}/photos`, { ...meta, photoId: urls.body.photoId })
    .expect(201);
  return done.body as { id: string };
}
