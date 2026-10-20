import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class ShareActionDto {
  @ApiProperty({
    description: 'Action to perform on the share',
    enum: ['accept', 'reject'],
    example: 'accept',
  })
  @IsIn(['accept', 'reject'])
  @IsNotEmpty()
  action: 'accept' | 'reject';
}
