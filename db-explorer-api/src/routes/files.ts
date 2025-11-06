import express from 'express';
import multer from 'multer';
import { FileUploadController } from '../controllers/FileUploadController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const fileUploadController = new FileUploadController();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB general limit
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Basic file validation
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/webm'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// Product images upload (specialized for product images with stricter validation)
const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for product images
    files: 5 // Maximum 5 images per product
  },
  fileFilter: (req, file, cb) => {
    const allowedImageMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/webp'
    ];

    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only JPEG, PNG, and WebP images are allowed for products. Received: ${file.mimetype}`));
    }
  }
});

// Routes

// Upload single file
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  fileUploadController.uploadFile.bind(fileUploadController)
);

// Upload multiple files
router.post(
  '/upload/multiple',
  authenticateToken,
  upload.array('files', 10),
  fileUploadController.uploadMultipleFiles.bind(fileUploadController)
);

// Upload call images (specialized endpoint)
router.post(
  '/upload/images',
  authenticateToken,
  imageUpload.array('images', 5),
  fileUploadController.uploadImages.bind(fileUploadController)
);

// Get user's files
router.get(
  '/my-files',
  authenticateToken,
  fileUploadController.getUserFiles.bind(fileUploadController)
);

// Get file by ID
router.get(
  '/:id',
  fileUploadController.getFileById.bind(fileUploadController)
);

// Delete file
router.delete(
  '/:id',
  authenticateToken,
  fileUploadController.deleteFile.bind(fileUploadController)
);

// Error handling middleware for multer errors
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size exceeds the maximum allowed limit'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Number of files exceeds the maximum allowed limit'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        message: 'Unexpected file field in the request'
      });
    }
  }

  if (error.message) {
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message
    });
  }

  next(error);
});

export default router;