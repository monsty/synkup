import { Global, Module } from '@nestjs/common';

import { ClerkService } from './clerk.service.js';
import { UsersService } from './users.service.js';

/** Global : le garde d'authentification en a besoin dans chaque module qui l'utilise. */
@Global()
@Module({
  providers: [UsersService, ClerkService],
  exports: [UsersService, ClerkService],
})
export class UsersModule {}
