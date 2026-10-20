import { ApiProperty } from '@nestjs/swagger';

export class FileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  storagePath: string;

  @ApiProperty({ nullable: true })
  folderId: string | null;

  @ApiProperty()
  isDeleted: boolean;

  @ApiProperty({ nullable: true })
  deletedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
