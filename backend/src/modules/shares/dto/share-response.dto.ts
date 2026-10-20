import { ApiProperty } from '@nestjs/swagger';

class FileInfo {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  mimeType: string;
}

class UserInfo {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  fullName: string | null;
}

export class ShareResponseDto {
  @ApiProperty({ description: 'Share ID' })
  id: string;

  @ApiProperty({ description: 'File ID' })
  fileId: string;

  @ApiProperty({ description: 'Owner user ID' })
  ownerId: string;

  @ApiProperty({
    description: 'Shared with user ID (null for public links)',
    required: false,
  })
  sharedWithId?: string | null;

  @ApiProperty({ description: 'Unique share token' })
  token: string;

  @ApiProperty({ description: 'Whether the share is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Share status', required: false })
  status?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Full shareable URL' })
  shareUrl: string;

  @ApiProperty({
    description: 'File information',
    required: false,
    type: FileInfo,
  })
  file?: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
  };

  @ApiProperty({
    description: 'Owner information',
    required: false,
    type: UserInfo,
  })
  owner?: {
    id: string;
    email: string;
    fullName: string | null;
  };

  @ApiProperty({
    description: 'Shared with user information',
    required: false,
    type: UserInfo,
  })
  sharedWith?: {
    id: string;
    email: string;
    fullName: string | null;
  };
}
