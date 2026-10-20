import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'My Documents', description: 'Folder name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Parent folder ID' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
