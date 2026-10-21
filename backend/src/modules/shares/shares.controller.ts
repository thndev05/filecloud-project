import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SharesService } from './shares.service';
import {
  CreateShareDto,
  CreateDirectShareDto,
  ShareActionDto,
  ShareResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a share link for a file' })
  @ApiResponse({
    status: 201,
    description: 'Share link created successfully',
    type: ShareResponseDto,
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async createShare(
    @CurrentUser('id') userId: string,
    @Body() createShareDto: CreateShareDto,
  ) {
    return this.sharesService.createShare(userId, createShareDto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all shares created by current user' })
  @ApiResponse({
    status: 200,
    description: 'List of shares',
    type: [ShareResponseDto],
  })
  async getMyShares(@CurrentUser('id') userId: string) {
    return this.sharesService.getMyShares(userId);
  }

  @Get(':token')
  @ApiOperation({ summary: 'Get share details by token (public)' })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiResponse({
    status: 200,
    description: 'Share details',
    type: ShareResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Share not found or inactive' })
  async getShareByToken(@Param('token') token: string) {
    return this.sharesService.getShareByToken(token);
  }

  @Get(':token/download')
  @ApiOperation({ summary: 'Get download URL for shared file (public)' })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiResponse({
    status: 200,
    description: 'Download URL',
    schema: { properties: { url: { type: 'string' } } },
  })
  @ApiResponse({ status: 404, description: 'Share not found or inactive' })
  async getDownloadUrl(@Param('token') token: string) {
    const url = await this.sharesService.getFileDownloadUrl(token);
    return { url };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a share link' })
  @ApiParam({ name: 'id', description: 'Share ID' })
  @ApiResponse({ status: 200, description: 'Share deleted successfully' })
  @ApiResponse({ status: 404, description: 'Share not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async deleteShare(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.sharesService.deleteShare(userId, id);
    return { message: 'Share deleted successfully' };
  }

  @Post('direct')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share a file directly with another user' })
  @ApiResponse({
    status: 201,
    description: 'File shared successfully',
    type: ShareResponseDto,
  })
  @ApiResponse({ status: 404, description: 'File or user not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createDirectShare(
    @CurrentUser('id') userId: string,
    @Body() createDirectShareDto: CreateDirectShareDto,
  ) {
    return this.sharesService.createDirectShare(userId, createDirectShareDto);
  }

  @Get('received/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all files shared with current user (accepted)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of received shares',
    type: [ShareResponseDto],
  })
  async getReceivedShares(@CurrentUser('id') userId: string) {
    return this.sharesService.getReceivedShares(userId);
  }

  @Get('received/pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending share requests' })
  @ApiResponse({
    status: 200,
    description: 'List of pending shares',
    type: [ShareResponseDto],
  })
  async getPendingShares(@CurrentUser('id') userId: string) {
    return this.sharesService.getPendingShares(userId);
  }

  @Patch(':id/action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept or reject a share request' })
  @ApiParam({ name: 'id', description: 'Share ID' })
  @ApiResponse({ status: 200, description: 'Share action completed' })
  @ApiResponse({ status: 404, description: 'Share not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async handleShareAction(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() shareActionDto: ShareActionDto,
  ) {
    if (shareActionDto.action === 'accept') {
      const share = await this.sharesService.acceptShare(userId, id);
      return { message: 'Share accepted', share };
    } else {
      await this.sharesService.rejectShare(userId, id);
      return { message: 'Share rejected' };
    }
  }

  @Get('file/:shareId/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get download URL for received shared file' })
  @ApiParam({ name: 'shareId', description: 'Share ID' })
  @ApiResponse({
    status: 200,
    description: 'Download URL',
    schema: { properties: { url: { type: 'string' } } },
  })
  @ApiResponse({ status: 404, description: 'Share not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async getSharedFileDownloadUrl(
    @CurrentUser('id') userId: string,
    @Param('shareId') shareId: string,
  ) {
    const url = await this.sharesService.getSharedFileDownloadUrl(
      userId,
      shareId,
    );
    return { url };
  }
}
