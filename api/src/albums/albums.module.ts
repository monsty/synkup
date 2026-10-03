import { Module } from '@nestjs/common';

import { AlbumsController } from './albums.controller.js';
import { AlbumsService } from './albums.service.js';

@Module({
  controllers: [AlbumsController],
  providers: [AlbumsService],
})
export class AlbumsModule {}
