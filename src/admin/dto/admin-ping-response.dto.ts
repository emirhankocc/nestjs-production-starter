import { ApiProperty } from '@nestjs/swagger';

export class AdminPingResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'Admin access granted' })
  message!: string;
}
