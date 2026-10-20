import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME');
  }

  async onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT'),
      port: parseInt(this.configService.get<string>('MINIO_PORT')),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });

    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created successfully`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists`);
      }
    } catch (error) {
      this.logger.error(`Error ensuring bucket exists: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    fileName: string,
    file: Buffer,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file,
        file.length,
        metadata,
      );
      this.logger.log(`File ${fileName} uploaded successfully`);
      return fileName;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const chunks: Buffer[] = [];
      const stream = await this.minioClient.getObject(
        this.bucketName,
        fileName,
      );

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Error downloading file: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, fileName);
      this.logger.log(`File ${fileName} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUrl(fileName: string, expiry = 3600): Promise<string> {
    try {
      const url = await this.minioClient.presignedGetObject(
        this.bucketName,
        fileName,
        expiry,
      );
      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned URL: ${error.message}`);
      throw error;
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, fileName);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileInfo(fileName: string) {
    try {
      return await this.minioClient.statObject(this.bucketName, fileName);
    } catch (error) {
      this.logger.error(`Error getting file info: ${error.message}`);
      throw error;
    }
  }
}
