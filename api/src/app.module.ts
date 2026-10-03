import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AlbumsModule } from './albums/albums.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, StorageModule, UsersModule, AlbumsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
