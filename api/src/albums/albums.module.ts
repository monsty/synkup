import { Module } from '@nestjs/common';

import { AlbumsController } from './albums.controller.js';
import { AlbumsService } from './albums.service.js';
import { InvitesController } from './invites.controller.js';
import { InvitesService } from './invites.service.js';
import { PhotosService } from './photos.service.js';

@Module({
  controllers: [AlbumsController, InvitesController],
  providers: [AlbumsService, PhotosService, InvitesService],
})
export class AlbumsModule {}
