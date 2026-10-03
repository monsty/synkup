import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ClerkProfile = {
  email: string | null;
  firstName: string | null;
  imageUrl: string | null;
};

/**
 * Seul point de contact avec l'API de Clerk (lecture d'un compte, suppression). Isolé pour
 * être remplacé dans les tests, qui n'appellent jamais Clerk.
 */
@Injectable()
export class ClerkService {
  private readonly clerk: ClerkClient;

  constructor(config: ConfigService) {
    this.clerk = createClerkClient({
      secretKey: config.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  async getProfile(userId: string): Promise<ClerkProfile> {
    const user = await this.clerk.users.getUser(userId);
    return {
      email:
        (user.primaryEmailAddress ?? user.emailAddresses[0])?.emailAddress ??
        null,
      firstName: user.firstName?.trim() || null,
      imageUrl: user.hasImage ? user.imageUrl : null,
    };
  }

  /** Supprime le compte chez Clerk : sessions fermées, connexion impossible. */
  async deleteUser(userId: string): Promise<void> {
    await this.clerk.users.deleteUser(userId);
  }
}
