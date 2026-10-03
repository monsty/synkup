import { Module } from '@nestjs/common';

import { AlbumsController } from './albums.controller.js';
import { AlbumsService } from './albums.service.js';
import { PhotosService } from './photos.service.js';

@Module({
  controllers: [AlbumsController],
  providers: [AlbumsService, PhotosService],
})
export class AlbumsModule {}
