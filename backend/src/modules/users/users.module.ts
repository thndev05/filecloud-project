import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [PrismaModule, MinioModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
