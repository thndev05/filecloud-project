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
  Request,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    @Request() req,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @UploadedFile() file: any,
    @Body('folderId') folderId?: string,
  ): Promise<FileResponseDto> {
    return this.filesService.uploadFile(req.user.id, file, folderId);
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
    @Request() req,
    @Query('folderId') folderId?: string,
  ): Promise<FileResponseDto[]> {
    return this.filesService.findAll(req.user.id, folderId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent files' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [FileResponseDto] })
  async getRecentFiles(
    @Request() req,
    @Query('limit') limit?: number,
  ): Promise<FileResponseDto[]> {
    return this.filesService.getRecentFiles(req.user.id, limit);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Get files in trash' })
  @ApiResponse({ status: 200, type: [FileResponseDto] })
  async getTrash(@Request() req): Promise<FileResponseDto[]> {
    return this.filesService.findAll(req.user.id, undefined, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  @ApiResponse({ status: 404, description: 'File not found' })
  async findOne(
    @Request() req,
    @Param('id') id: string,
  ): Promise<FileResponseDto> {
    return this.filesService.findOne(req.user.id, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  @ApiResponse({ status: 200, description: 'File downloaded' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @Request() req,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findOne(req.user.id, id);
    const buffer = await this.filesService.downloadFile(req.user.id, id);

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
    @Request() req,
    @Param('id') id: string,
    @Body() renameFileDto: RenameFileDto,
  ): Promise<FileResponseDto> {
    return this.filesService.renameFile(req.user.id, id, renameFileDto.name);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move file to folder' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async moveFile(
    @Request() req,
    @Param('id') id: string,
    @Body() moveFileDto: MoveFileDto,
  ): Promise<FileResponseDto> {
    return this.filesService.moveFile(req.user.id, id, moveFileDto.folderId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move file to trash' })
  @ApiResponse({ status: 200 })
  async moveToTrash(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.filesService.moveToTrash(req.user.id, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore file from trash' })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async restoreFile(
    @Request() req,
    @Param('id') id: string,
  ): Promise<FileResponseDto> {
    return this.filesService.restoreFile(req.user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Delete file permanently' })
  @ApiResponse({ status: 200 })
  async deleteFilePermanently(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.filesService.deleteFilePermanently(req.user.id, id);
  }
}
