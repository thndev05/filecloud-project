import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveFileDto {
  @ApiPropertyOptional({ description: 'Target folder ID' })
  @IsOptional()
  @IsString()
  folderId?: string;
}
