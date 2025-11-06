import { Request, Response } from 'express';
import { FileUploadService } from '../services/FileUploadService.js';
import { FileType } from '../types/common.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class FileUploadController {
  /**
   * Upload single file
   */
  public async uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to upload files'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided',
          message: 'Please select a file to upload'
        });
        return;
      }

      const options = {
        filePath: req.body.filePath,
        isPublic: req.body.isPublic !== 'false', // Default to true
        ...(req.body.maxSizeBytes && { maxSizeBytes: parseInt(req.body.maxSizeBytes) }),
        ...(req.body.allowedMimeTypes && { allowedMimeTypes: req.body.allowedMimeTypes.split(',') })
      };

      const uploadedFile = await FileUploadService.uploadFile(
        req.file,
        req.user.id,
        options
      );

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: uploadedFile
      });

    } catch (error: any) {
      console.error('Upload file error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'File upload failed',
        message: 'Failed to upload file'
      });
    }
  }

  /**
   * Upload multiple files
   */
  public async uploadMultipleFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to upload files'
        });
        return;
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files provided',
          message: 'Please select files to upload'
        });
        return;
      }

      const options = {
        filePath: req.body.filePath,
        isPublic: req.body.isPublic !== 'false', // Default to true
        ...(req.body.maxSizeBytes && { maxSizeBytes: parseInt(req.body.maxSizeBytes) }),
        ...(req.body.allowedMimeTypes && { allowedMimeTypes: req.body.allowedMimeTypes.split(',') })
      };

      const uploadedFiles = await FileUploadService.uploadMultipleFiles(
        req.files as Express.Multer.File[],
        req.user.id,
        options
      );

      res.status(201).json({
        success: true,
        message: `${uploadedFiles.length} files uploaded successfully`,
        data: uploadedFiles
      });

    } catch (error: any) {
      console.error('Upload multiple files error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'File upload failed',
        message: 'Failed to upload files'
      });
    }
  }

  /**
   * Get user's files
   */
  public async getUserFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to view files'
        });
        return;
      }

      const fileType = req.query.fileType as FileType | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const files = await FileUploadService.getFilesByUser(
        req.user.id,
        fileType,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        message: 'Files retrieved successfully',
        data: files
      });

    } catch (error: any) {
      console.error('Get user files error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve files',
        message: 'Failed to retrieve files'
      });
    }
  }

  /**
   * Get file by ID
   */
  public async getFileById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'File ID required',
          message: 'Please provide a valid file ID'
        });
        return;
      }

      const file = await FileUploadService.getFileById(id);

      if (!file) {
        res.status(404).json({
          success: false,
          error: 'File not found',
          message: 'The requested file does not exist'
        });
        return;
      }

      // Check if user has access to this file (owner or public file)
      if (!file.isPublic && file.userId !== req.user?.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to access this file'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'File retrieved successfully',
        data: file
      });

    } catch (error: any) {
      console.error('Get file by ID error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve file',
        message: 'Failed to retrieve file'
      });
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to delete files'
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'File ID required',
          message: 'Please provide a valid file ID'
        });
        return;
      }

      await FileUploadService.deleteFile(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
        data: null
      });

    } catch (error: any) {
      console.error('Delete file error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to delete file',
        message: 'Failed to delete file'
      });
    }
  }

  /**
   * Upload images (specialized endpoint for images)
   */
  public async uploadImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to upload images'
        });
        return;
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No images provided',
          message: 'Please select images to upload'
        });
        return;
      }

      // Validate that all files are images
      const imageFiles = req.files as Express.Multer.File[];
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      for (const file of imageFiles) {
        if (!allowedImageTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: 'Invalid file type',
            message: `File ${file.originalname} is not a valid image. Only JPEG, PNG, and WebP images are allowed.`
          });
          return;
        }
      }

      const options = {
        filePath: req.body.filePath, // Will default to 'media' for images in the service
        isPublic: req.body.isPublic !== 'false', // Default to true
        maxSizeBytes: 5 * 1024 * 1024, // 5MB limit for images
        allowedMimeTypes: allowedImageTypes
      };

      const uploadedFiles = await FileUploadService.uploadMultipleFiles(
        imageFiles,
        req.user.id,
        options
      );

      res.status(201).json({
        success: true,
        message: `${uploadedFiles.length} images uploaded successfully`,
        data: uploadedFiles
      });

    } catch (error: any) {
      console.error('Upload images error:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Image upload failed',
        message: 'Failed to upload images'
      });
    }
  }
}