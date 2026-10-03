import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { CurrentUser } from '../auth/current-user.js';
import { User } from '../auth/user.decorator.js';
import { CreateAlbumDto, UpdateAlbumDto, UpdateMemberDto } from './albums.dto.js';
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

  @Post()
  create(@User() user: CurrentUser, @Body() body: CreateAlbumDto) {
    return this.albums.create(user.id, body);
  }

  @Get(':id')
  get(@User() user: CurrentUser, @Param('id') id: string) {
    return this.albums.getForUser(id, user.id);
  }

  /** Nom, période ou couverture : propriétaire seulement. */
  @Patch(':id')
  update(@User() user: CurrentUser, @Param('id') id: string, @Body() body: UpdateAlbumDto) {
    return this.albums.update(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@User() user: CurrentUser, @Param('id') id: string) {
    return this.albums.remove(id, user.id);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.albums.updateMemberRole(id, user.id, memberId, body.role);
  }

  @Delete(':id/members/:memberId')
  removeMember(@User() user: CurrentUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.albums.removeMember(id, user.id, memberId);
  }
}
