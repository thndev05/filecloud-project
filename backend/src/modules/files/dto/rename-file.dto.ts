import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameFileDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  name: string;
}
