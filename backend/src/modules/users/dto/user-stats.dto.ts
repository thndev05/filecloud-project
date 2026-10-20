import { ApiProperty } from '@nestjs/swagger';

export class UserStatsDto {
  @ApiProperty({ example: 1234, description: 'Total number of files' })
  totalFiles: number;

  @ApiProperty({ example: 56, description: 'Total number of folders' })
  totalFolders: number;

  @ApiProperty({ example: 16842752000, description: 'Storage used in bytes' })
  usedStorage: number;

  @ApiProperty({ example: 53687091200, description: 'Maximum storage in bytes (50GB)' })
  maxStorage: number;
}
