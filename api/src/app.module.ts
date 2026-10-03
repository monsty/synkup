import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AlbumsModule } from './albums/albums.module.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { MeModule } from './me/me.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    StorageModule,
    UsersModule,
    AlbumsModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
