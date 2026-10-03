import type { MeDto, UploadUrlDto } from '@synkup/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { CurrentUser } from '../auth/current-user.js';
import { User } from '../auth/user.decorator.js';
import { AvatarUploadDto, UpdateMeDto } from './me.dto.js';
import { MeService } from './me.service.js';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Profil, offre et usage du quota. */
  @Get()
  get(@User() user: CurrentUser): Promise<MeDto> {
    return this.me.get(user.id);
  }

  /** Surnom ou photo de profil. L'email, lui, se change via Clerk. */
  @Patch()
  update(@User() user: CurrentUser, @Body() body: UpdateMeDto): Promise<MeDto> {
    return this.me.update(user.id, body);
  }

  /** URL d'envoi d'une photo de profil ; puis `PATCH /me` avec la clé. */
  @Post('avatar')
  avatarUpload(
    @User() user: CurrentUser,
    @Body() body: AvatarUploadDto,
  ): Promise<UploadUrlDto> {
    return this.me.avatarUpload(user.id, body.byteSize);
  }

  /** Suppression définitive du compte et de ses données. */
  @Delete()
  @HttpCode(204)
  remove(@User() user: CurrentUser): Promise<void> {
    return this.me.remove(user.id);
  }
}
