import { ApiProperty } from '@nestjs/swagger';

export class FolderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ nullable: true })
  parentId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
