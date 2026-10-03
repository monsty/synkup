import { Injectable } from '@nestjs/common';

import type { CurrentUser } from '../auth/current-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ClerkService } from './clerk.service.js';

/**
 * Utilisateurs Synkup. L'identité vient de Clerk : à la première requête d'un compte, on lit son
 * email, prénom et avatar chez Clerk, puis on crée la ligne `User`. Ensuite tout est local.
 */
@Injectable()
export class UsersService {
  /** Comptes déjà présents en base : évite une lecture par requête. */
  private readonly known = new Map<string, CurrentUser>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly clerk: ClerkService,
  ) {}

  /** Renvoie l'utilisateur, en le créant à partir de Clerk s'il n'existe pas encore. */
  async ensure(id: string): Promise<CurrentUser> {
    const cached = this.known.get(id);
    if (cached) return cached;

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (existing) return this.remember(existing);

    const profile = await this.clerk.getProfile(id);
    if (!profile.email)
      throw new Error(`Compte Clerk ${id} sans adresse email.`);
    const email = profile.email.toLowerCase();

    const user = await this.prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email,
        nickname: profile.firstName ?? email.split('@')[0],
        avatarUrl: profile.imageUrl,
      },
      select: { id: true, email: true },
    });
    return this.remember(user);
  }

  /** Développement : compte fictif d'un jeton `dev:…`, créé sans passer par Clerk. */
  async ensureDev(id: string, email: string): Promise<CurrentUser> {
    const user = await this.prisma.user.upsert({
      where: { id },
      update: {},
      create: { id, email, nickname: email.split('@')[0] },
      select: { id: true, email: true },
    });
    return this.remember(user);
  }

  /** Compte supprimé : il ne doit plus être servi par le cache. */
  forget(id: string) {
    this.known.delete(id);
  }

  /** Photo de profil à afficher : celle choisie dans l'app, sinon celle de Clerk. */
  async avatarUrlOf(user: {
    avatarKey: string | null;
    avatarUrl: string | null;
  }) {
    return user.avatarKey
      ? this.storage.readUrl(user.avatarKey)
      : user.avatarUrl;
  }

  private remember(user: CurrentUser): CurrentUser {
    this.known.set(user.id, user);
    return user;
  }
}
