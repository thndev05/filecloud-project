import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [PrismaModule, MinioModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
