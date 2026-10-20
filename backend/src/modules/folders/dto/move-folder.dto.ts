import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveFolderDto {
  @ApiPropertyOptional({ description: 'New parent folder ID' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
