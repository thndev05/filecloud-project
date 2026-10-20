import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameFolderDto {
  @ApiProperty({ example: 'New Folder Name' })
  @IsString()
  name: string;
}
