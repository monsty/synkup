import type { AlbumDto, InvitePreviewDto } from '@synkup/shared';
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { CurrentUser } from '../auth/current-user.js';
import { User } from '../auth/user.decorator.js';
import { InvitesService } from './invites.service.js';

/** Côté invité : voir l'album derrière un lien, puis le rejoindre. */
@Controller('invites')
@UseGuards(AuthGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  preview(
    @User() user: CurrentUser,
    @Param('token') token: string,
  ): Promise<InvitePreviewDto> {
    return this.invites.preview(token, user.id);
  }

  @Post(':token/accept')
  accept(
    @User() user: CurrentUser,
    @Param('token') token: string,
  ): Promise<AlbumDto> {
    return this.invites.accept(token, user.id);
  }
}
