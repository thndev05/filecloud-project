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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import {
  FolderResponseDto,
  CreateFolderDto,
  RenameFolderDto,
  MoveFolderDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('folders')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({ status: 201, type: FolderResponseDto })
  @ApiResponse({ status: 409, description: 'Folder name already exists' })
  async create(
    @Request() req,
    @Body() createFolderDto: CreateFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.create(req.user.id, createFolderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all folders' })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiResponse({ status: 200, type: [FolderResponseDto] })
  async findAll(
    @Request() req,
    @Query('parentId') parentId?: string,
  ): Promise<FolderResponseDto[]> {
    return this.foldersService.findAll(req.user.id, parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get folder by ID' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async findOne(
    @Request() req,
    @Param('id') id: string,
  ): Promise<FolderResponseDto> {
    return this.foldersService.findOne(req.user.id, id);
  }

  @Get(':id/contents')
  @ApiOperation({ summary: 'Get folder with its contents' })
  @ApiResponse({ status: 200 })
  async getFolderWithContents(@Request() req, @Param('id') id: string) {
    return this.foldersService.getFolderWithContents(req.user.id, id);
  }

  @Get(':id/breadcrumb')
  @ApiOperation({ summary: 'Get folder breadcrumb path' })
  @ApiResponse({ status: 200, type: [FolderResponseDto] })
  async getBreadcrumb(@Request() req, @Param('id') id: string) {
    return this.foldersService.getBreadcrumb(req.user.id, id);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename folder' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  async rename(
    @Request() req,
    @Param('id') id: string,
    @Body() renameFolderDto: RenameFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.rename(req.user.id, id, renameFolderDto.name);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move folder to another parent' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  async move(
    @Request() req,
    @Param('id') id: string,
    @Body() moveFolderDto: MoveFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.move(req.user.id, id, moveFolderDto.parentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete folder' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Folder is not empty' })
  async delete(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.foldersService.delete(req.user.id, id);
  }
}
