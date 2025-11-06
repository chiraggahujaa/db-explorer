import { supabaseAdmin } from '../lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { FileType } from '../types/common.js';
import { DataMapper } from '../utils/mappers.js';

export interface UploadedFile {
  id: string;
  userId: string;
  name: string;
  url: string;
  uploadedOn: string;
  fileType: FileType;
  fileSize: number;
  mimeType: string;
  altText?: string;
  isPublic: boolean;
  bucket?: string;
  path?: string;
  originalName?: string;
}

export interface FileUploadOptions {
  filePath?: string;
  isPublic?: boolean;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
}

export class FileUploadService {
  private static readonly DEFAULT_BUCKET = 'uploads';
  private static readonly IMAGE_BUCKET = 'images';
  private static readonly DOCUMENT_BUCKET = 'documents';
  private static readonly VIDEO_BUCKET = 'videos';
  
  private static readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100MB
  
  private static readonly IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  private static readonly DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];
  
  private static readonly VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];

  /**
   * Upload a single file to Supabase storage
   */
  public static async uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile> {
    try {
      console.log('FileUploadService.uploadFile called with:', { userId, fileName: file.originalname, fileSize: file.size });
      // Determine file type and validate
      const fileType = this.determineFileType(file.mimetype);
      const bucket = this.getBucketForFileType(fileType);
      
      // Validate file
      this.validateFile(file, fileType, options);
      
      // File path structure: {userId}/{filePath}/{year}/{month}/{fileName}
      const fileExtension = this.getFileExtension(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const filePath = options.filePath || this.getDefaultFilePathForFileType(fileType);
      const fullPath = `${userId}/${filePath}/${year}/${month}/${fileName}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fullPath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(fullPath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file');
      }

      // Create file record in database
      const fileRecord = {
        id: uuidv4(),
        user_id: userId,
        name: fileName,
        original_name: file.originalname,
        url: urlData.publicUrl,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.mimetype,
        is_public: options.isPublic ?? true,
        bucket,
        path: fullPath,
        uploaded_on: new Date().toISOString()
      };

      console.log('Attempting to insert file record:', fileRecord);
      
      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('file')
        .insert(fileRecord)
        .select()
        .single();
      
      console.log('Database insert result:', { dbData, dbError });

      if (dbError) {
        // Cleanup uploaded file if database insert fails
        await this.deleteFromStorage(bucket, fullPath);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      const result = {
        ...fileRecord,
        ...dbData
      };

      // Transform to camelCase before returning
      return DataMapper.toCamelCase(result) as UploadedFile;

    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  public static async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map(file => 
      this.uploadFile(file, userId, options)
    );
    
    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Multiple file upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a file by ID
   */
  public static async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      // Get file record from database
      const { data: fileRecord, error: selectError } = await supabaseAdmin
        .from('file')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (selectError || !fileRecord) {
        throw new Error('File not found or access denied');
      }

      // Delete from storage
      await this.deleteFromStorage(fileRecord.bucket, fileRecord.path);

      // Delete from database
      const { error: deleteError } = await supabaseAdmin
        .from('file')
        .delete()
        .eq('id', fileId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete file record: ${deleteError.message}`);
      }

    } catch (error) {
      console.error('File deletion error:', error);
      throw error;
    }
  }

  /**
   * Get files by user ID
   */
  public static async getFilesByUser(
    userId: string,
    fileType?: FileType,
    limit: number = 50,
    offset: number = 0
  ): Promise<UploadedFile[]> {
    try {
      let query = supabaseAdmin
        .from('file')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_on', { ascending: false })
        .range(offset, offset + limit - 1);

      if (fileType) {
        query = query.eq('file_type', fileType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch files: ${error.message}`);
      }

      // Transform to camelCase before returning
      return DataMapper.toCamelCase(data || []) as UploadedFile[];

    } catch (error) {
      console.error('Get files error:', error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  public static async getFileById(fileId: string): Promise<UploadedFile | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('file')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error) {
        return null;
      }

      // Transform to camelCase before returning
      return DataMapper.toCamelCase(data) as UploadedFile;

    } catch (error) {
      console.error('Get file by ID error:', error);
      return null;
    }
  }

  // Private helper methods

  private static determineFileType(mimeType: string): FileType {
    if (this.IMAGE_MIME_TYPES.includes(mimeType)) {
      return 'image';
    } else if (this.DOCUMENT_MIME_TYPES.includes(mimeType)) {
      return 'document';
    } else if (this.VIDEO_MIME_TYPES.includes(mimeType)) {
      return 'video';
    } else {
      return 'other';
    }
  }

  private static getBucketForFileType(fileType: FileType): string {
    switch (fileType) {
      case 'image':
        return FileUploadService.IMAGE_BUCKET;
      case 'document':
        return FileUploadService.DOCUMENT_BUCKET;
      case 'video':
        return FileUploadService.VIDEO_BUCKET;
      default:
        return FileUploadService.DEFAULT_BUCKET;
    }
  }

  private static getDefaultFilePathForFileType(fileType: FileType): string {
    switch (fileType) {
      case 'image':
        return 'media';
      case 'document':
        return 'documents';
      case 'video':
        return 'media';
      default:
        return 'uploads';
    }
  }

  private static validateFile(
    file: Express.Multer.File,
    fileType: FileType,
    options: FileUploadOptions
  ): void {
    // Check file size
    const maxSize = options.maxSizeBytes || this.getMaxSizeForFileType(fileType);
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    // Check mime type if restricted
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Check if file type is allowed
    const allowedMimeTypes = this.getAllowedMimeTypesForFileType(fileType);
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not supported`);
    }
  }

  private static getMaxSizeForFileType(fileType: FileType): number {
    switch (fileType) {
      case 'image':
        return this.IMAGE_MAX_SIZE;
      case 'video':
        return this.VIDEO_MAX_SIZE;
      default:
        return this.DEFAULT_MAX_SIZE;
    }
  }

  private static getAllowedMimeTypesForFileType(fileType: FileType): string[] {
    switch (fileType) {
      case 'image':
        return this.IMAGE_MIME_TYPES;
      case 'document':
        return this.DOCUMENT_MIME_TYPES;
      case 'video':
        return this.VIDEO_MIME_TYPES;
      default:
        return [...this.IMAGE_MIME_TYPES, ...this.DOCUMENT_MIME_TYPES, ...this.VIDEO_MIME_TYPES];
    }
  }

  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  private static async deleteFromStorage(bucket: string, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.warn(`Failed to delete file from storage: ${error.message}`);
      // Don't throw error for storage cleanup failures
    }
  }
}