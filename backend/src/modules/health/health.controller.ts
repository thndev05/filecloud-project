import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'up')
      .catch(() => 'down');
    const storage = (await this.minio.isHealthy()) ? 'up' : 'down';
    const ok = database === 'up' && storage === 'up';

    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'error', database, storage };
  }
}
