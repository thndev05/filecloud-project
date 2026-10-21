import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FileResponseDto, RenameFileDto, MoveFileDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('files')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @CurrentUser('id') userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @UploadedFile() file: any,
    @Body('folderId') folderId?: string,
  ): Promise<FileResponseDto> {
    return this.filesService.uploadFile(userId, file, folderId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all files' })
  @ApiQuery({
    name: 'folderId',
    required: false,
    description: 'Filter by folder ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all files',
    type: [FileResponseDto],
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('folderId') folderId?: string,
  ): Promise<FileResponseDto[]> {
    return this.filesService.findAll(userId, folderId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent files' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [FileResponseDto] })
  async getRecentFiles(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ): Promise<FileResponseDto[]> {
    return this.filesService.getRecentFiles(userId, limit);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Get files in trash' })
  @ApiResponse({ status: 200, type: [FileResponseDto] })
  async getTrash(
    @CurrentUser('id') userId: string,
  ): Promise<FileResponseDto[]> {
    return this.filesService.findAll(userId, undefined, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  @ApiResponse({ status: 404, description: 'File not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<FileResponseDto> {
    return this.filesService.findOne(userId, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  @ApiResponse({ status: 200, description: 'File downloaded' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findOne(userId, id);
    const buffer = await this.filesService.downloadFile(userId, id);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.name}"`,
      'Content-Length': file.size,
    });

    return new StreamableFile(buffer);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename file' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async renameFile(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() renameFileDto: RenameFileDto,
  ): Promise<FileResponseDto> {
    return this.filesService.renameFile(userId, id, renameFileDto.name);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move file to folder' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async moveFile(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() moveFileDto: MoveFileDto,
  ): Promise<FileResponseDto> {
    return this.filesService.moveFile(userId, id, moveFileDto.folderId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move file to trash' })
  @ApiResponse({ status: 200 })
  async moveToTrash(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.filesService.moveToTrash(userId, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore file from trash' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async restoreFile(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<FileResponseDto> {
    return this.filesService.restoreFile(userId, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Delete file permanently' })
  @ApiResponse({ status: 200 })
  async deleteFilePermanently(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.filesService.deleteFilePermanently(userId, id);
  }
}
