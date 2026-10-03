import { Global, Module } from '@nestjs/common';

import { UsersService } from './users.service.js';

/** Global : le garde d'authentification en a besoin dans chaque module qui l'utilise. */
@Global()
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
