import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { CurrentUser } from './current-user.js';

/**
 * Vérifie le jeton porteur et pose l'utilisateur sur la requête.
 *
 * POC : tant que Clerk n'est pas branché, un jeton `dev:<userId>:<email>` est accepté en
 * développement. En production, remplacer `verify` par la vérification du JWT Clerk
 * (`@clerk/backend`, `verifyToken`) : même forme de sortie, rien d'autre ne change.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedException('Jeton manquant.');

    request.user = this.verify(token);
    return true;
  }

  private verify(token: string): CurrentUser {
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    if (isDev && token.startsWith('dev:')) {
      const [, id, email] = token.split(':');
      if (id && email) return { id, email };
    }
    throw new UnauthorizedException('Jeton invalide.');
  }
}
