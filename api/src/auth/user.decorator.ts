import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { CurrentUser } from './current-user.js';

/** Injecte l'utilisateur authentifié dans un handler : `@User() user: CurrentUser`. */
export const User = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  return request.user as CurrentUser;
});
