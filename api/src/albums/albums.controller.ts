import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { CurrentUser } from '../auth/current-user.js';
import { User } from '../auth/user.decorator.js';
import {
  CreateAlbumDto,
  UpdateAlbumDto,
  UpdateMemberDto,
} from './albums.dto.js';
import { AlbumsService } from './albums.service.js';
import {
  CompletePhotoDto,
  CoverUploadDto,
  DeletePhotosDto,
  RequestUploadDto,
} from './photos.dto.js';
import { PhotosService } from './photos.service.js';

@Controller('albums')
@UseGuards(AuthGuard)
export class AlbumsController {
  constructor(
    private readonly albums: AlbumsService,
    private readonly photos: PhotosService,
  ) {}

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
  update(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: UpdateAlbumDto,
  ) {
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
  removeMember(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.albums.removeMember(id, user.id, memberId);
  }

  /** URL d'envoi d'une couverture choisie à la main ; puis `PATCH /albums/:id` avec la clé. */
  @Post(':id/cover')
  coverUpload(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: CoverUploadDto,
  ) {
    return this.albums.coverUpload(id, user.id, body.byteSize);
  }

  @Get(':id/photos')
  listPhotos(@User() user: CurrentUser, @Param('id') id: string) {
    return this.photos.list(id, user.id);
  }

  /** Étape 1 de l'envoi : URL signées pour l'originale, l'affichage et la miniature. */
  @Post(':id/photos/uploads')
  requestUpload(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: RequestUploadDto,
  ) {
    return this.photos.requestUpload(id, user.id, body);
  }

  /** Étape 2 : les fichiers sont dans le bucket, la photo rejoint l'album. */
  @Post(':id/photos')
  completeUpload(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: CompletePhotoDto,
  ) {
    return this.photos.complete(id, user.id, body);
  }

  @Post(':id/photos/delete')
  @HttpCode(204)
  deletePhotos(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: DeletePhotosDto,
  ) {
    return this.photos.remove(id, user.id, body.ids);
  }
}
