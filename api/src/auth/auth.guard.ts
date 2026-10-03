import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import type { CurrentUser } from './current-user.js';

/**
 * Vérifie le jeton de session Clerk (en-tête `Authorization: Bearer …`) et pose l'utilisateur
 * sur la requête. La signature est contrôlée avec les clés publiques de l'instance, récupérées
 * puis mises en cache par `@clerk/backend`.
 *
 * En développement, un jeton `dev:<userId>:<email>` est aussi accepté, pour tester à la main
 * avec curl sans passer par l'app.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly secretKey: string;
  private readonly isDev: boolean;

  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    this.secretKey = config.getOrThrow<string>('CLERK_SECRET_KEY');
    this.isDev = config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      this.logger.warn(`${request.method} ${request.path} : jeton manquant`);
      throw new UnauthorizedException('Jeton manquant.');
    }

    request.user = await this.verify(token);
    return true;
  }

  private async verify(token: string): Promise<CurrentUser> {
    if (this.isDev && token.startsWith('dev:')) {
      const [, id, email] = token.split(':');
      if (id && email) return this.users.ensureDev(id, email);
    }

    // Le `verifyToken` exporté renvoie le payload et lève en cas d'échec (son type annonce
    // `{ data, errors }`, mais c'est celui de la fonction interne).
    let sub: string | undefined;
    try {
      const payload = (await verifyToken(token, { secretKey: this.secretKey })) as unknown as {
        sub?: string;
      };
      sub = payload.sub;
    } catch (error) {
      this.logger.warn(`Jeton refusé : ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!sub) throw new UnauthorizedException('Jeton invalide.');
    return this.users.ensure(sub);
  }
}
