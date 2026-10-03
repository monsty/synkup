import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { CurrentUser } from '../auth/current-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Utilisateurs Synkup. L'identité vient de Clerk : à la première requête d'un compte, on lit son
 * email, prénom et avatar chez Clerk, puis on crée la ligne `User`. Ensuite tout est local.
 */
@Injectable()
export class UsersService {
  private readonly clerk: ClerkClient;
  /** Comptes déjà présents en base : évite une lecture par requête. */
  private readonly known = new Map<string, CurrentUser>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: config.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  /** Renvoie l'utilisateur, en le créant à partir de Clerk s'il n'existe pas encore. */
  async ensure(id: string): Promise<CurrentUser> {
    const cached = this.known.get(id);
    if (cached) return cached;

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (existing) return this.remember(existing);

    const profile = await this.clerk.users.getUser(id);
    const email = (profile.primaryEmailAddress ?? profile.emailAddresses[0])
      ?.emailAddress;
    if (!email) throw new Error(`Compte Clerk ${id} sans adresse email.`);

    const user = await this.prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: email.toLowerCase(),
        nickname: profile.firstName?.trim() || email.split('@')[0],
        avatarUrl: profile.hasImage ? profile.imageUrl : null,
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

  private remember(user: CurrentUser): CurrentUser {
    this.known.set(user.id, user);
    return user;
  }
}
