import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip JwtAuthGuard for a route (or a whole controller). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
