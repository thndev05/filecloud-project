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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    @CurrentUser('id') userId: string,
    @Body() createFolderDto: CreateFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.create(userId, createFolderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all folders' })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiResponse({ status: 200, type: [FolderResponseDto] })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('parentId') parentId?: string,
  ): Promise<FolderResponseDto[]> {
    return this.foldersService.findAll(userId, parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get folder by ID' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<FolderResponseDto> {
    return this.foldersService.findOne(userId, id);
  }

  @Get(':id/contents')
  @ApiOperation({ summary: 'Get folder with its contents' })
  @ApiResponse({ status: 200 })
  async getFolderWithContents(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.foldersService.getFolderWithContents(userId, id);
  }

  @Get(':id/breadcrumb')
  @ApiOperation({ summary: 'Get folder breadcrumb path' })
  @ApiResponse({ status: 200, type: [FolderResponseDto] })
  async getBreadcrumb(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.foldersService.getBreadcrumb(userId, id);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename folder' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  async rename(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() renameFolderDto: RenameFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.rename(userId, id, renameFolderDto.name);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move folder to another parent' })
  @ApiResponse({ status: 200, type: FolderResponseDto })
  async move(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() moveFolderDto: MoveFolderDto,
  ): Promise<FolderResponseDto> {
    return this.foldersService.move(userId, id, moveFolderDto.parentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete folder' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Folder is not empty' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.foldersService.delete(userId, id);
  }
}
