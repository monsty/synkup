import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { CurrentUser } from '../auth/current-user.js';
import { User } from '../auth/user.decorator.js';
import { AlbumsService } from './albums.service.js';

@Controller('albums')
@UseGuards(AuthGuard)
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  /** GET /albums : les albums de l'utilisateur authentifié. */
  @Get()
  list(@User() user: CurrentUser) {
    return this.albums.listForUser(user.id);
  }
}
