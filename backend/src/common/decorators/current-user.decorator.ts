import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Authenticated user set by JwtStrategy.
 * `@CurrentUser()` → whole user, `@CurrentUser('id')` → a single field.
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    return field ? user?.[field] : user;
  },
);
