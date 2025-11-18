"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  Eye,
  Trash2,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/utils/ui";
import { filesAPI } from "@/lib/api/files";

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  originalName?: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
}

export interface ImageUploadProps {
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedFileTypes?: string[];
  onFilesChange?: (files: UploadedFile[]) => void;
  onUploadStart?: () => void;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  existingFiles?: UploadedFile[];
  disabled?: boolean;
  className?: string;
  filePath?: string;
}

export function ImageUpload({
  maxFiles = 5,
  maxSizeBytes = 5 * 1024 * 1024, // 5MB
  acceptedFileTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  onFilesChange,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  existingFiles = [],
  disabled = false,
  className,
  filePath,
}: ImageUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [, setUploading] = useState(false);

  useEffect(() => {
    setFiles(existingFiles);
  }, [existingFiles]);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<UploadedFile | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const result = await filesAPI.uploadImages([file], filePath, true);

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(
        result.message || "Upload failed - no file data returned"
      );
    }

    return result.data[0];
  };

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return;

      setErrors([]);

      // Check if adding these files would exceed the max files limit
      if (files.length + acceptedFiles.length > maxFiles) {
        setErrors([
          `Maximum ${maxFiles} files allowed. You can upload ${
            maxFiles - files.length
          } more file(s).`,
        ]);
        return;
      }

      // Validate file function inside callback
      const validateFile = (file: File): string | null => {
        if (!acceptedFileTypes.includes(file.type)) {
          return `File type ${
            file.type
          } is not supported. Please use ${acceptedFileTypes.join(", ")}.`;
        }

        if (file.size > maxSizeBytes) {
          return `File size exceeds ${Math.round(
            maxSizeBytes / 1024 / 1024
          )}MB limit.`;
        }

        return null;
      };

      // Validate each file
      const validationErrors: string[] = [];
      const validFiles: File[] = [];

      acceptedFiles.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (validFiles.length === 0) return;

      setUploading(true);
      onUploadStart?.();

      try {
        const uploadPromises = validFiles.map(async (file) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

          // Simulate progress for UI feedback
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: Math.min((prev[file.name] || 0) + 10, 90),
            }));
          }, 100);

          try {
            const uploadedFile = await uploadFile(file);
            clearInterval(progressInterval);
            setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
            return uploadedFile;
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        const newFiles = [...files, ...uploadedFiles];

        setFiles(newFiles);
        onFilesChange?.(newFiles);
        onUploadComplete?.(uploadedFiles);

        // Clear progress after a short delay
        setTimeout(() => {
          setUploadProgress({});
        }, 1000);
      } catch (error: unknown) {
        console.error("Upload error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setErrors([errorMessage]);
        onUploadError?.(errorMessage);
      } finally {
        setUploading(false);
      }
    },
    [disabled, files, maxFiles, onUploadStart, acceptedFileTypes, maxSizeBytes, onFilesChange, onUploadComplete, uploadFile, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: {
      "image/*": acceptedFileTypes.map((type) => type.replace("image/", ".")),
    },
    disabled,
    maxFiles: maxFiles - files.length,
    multiple: maxFiles > 1,
  });

  const removeFile = async (fileId: string) => {
    if (disabled) return;

    try {
      // Remove from backend first
      const result = await filesAPI.deleteFile(fileId);
      
      if (!result.success) {
        console.error("Failed to delete file from backend:", result.error);
        setErrors([result.error || "Failed to delete file"]);
        return;
      }

      // Remove from UI after successful backend deletion
      const newFiles = files.filter((file) => file.id !== fileId);
      setFiles(newFiles);
      onFilesChange?.(newFiles);
    } catch (error) {
      console.error("Error deleting file:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete file";
      setErrors([errorMessage]);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const resetZoomAndPosition = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handlePreviewOpen = (file: UploadedFile) => {
    setPreviewImage(file);
    resetZoomAndPosition();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={cn(
              "flex flex-col items-center justify-center text-center space-y-4 cursor-pointer",
              disabled && "cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} ref={fileInputRef} />

            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium">
                {isDragActive ? "Drop images here" : "Upload product images"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Drag & drop images here, or{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={handleButtonClick}
                  disabled={disabled}
                >
                  browse files
                </Button>
              </p>
              <p className="text-xs text-muted-foreground">
                Supports:{" "}
                {acceptedFileTypes
                  .map((type) => type.split("/")[1].toUpperCase())
                  .join(", ")}{" "}
                • Max {Math.round(maxSizeBytes / 1024 / 1024)}MB each • Up to{" "}
                {maxFiles} files
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploading...</h4>
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{fileName}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Uploaded Images ({files.length}/{maxFiles})
            </h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map((file) => (
              <div key={file.id} className="relative group">
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1 p-0">
                  <div
                    className="aspect-square relative cursor-pointer"
                    onClick={() => handlePreviewOpen(file)}
                  >
                    <Image
                      src={file.url}
                      alt={file.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewOpen(file);
                        }}
                        disabled={disabled}
                        className="h-9 w-9 p-0 bg-white/90 hover:bg-white backdrop-blur-sm"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeFile(file.id);
                        }}
                        disabled={disabled}
                        className="h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="px-2.5 pb-2 pt-1.5">
                    <div className="space-y-1">
                      <p
                        className="text-xs font-medium truncate"
                        title={file.originalName || file.name}
                      >
                        {file.originalName || file.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs h-5">
                          {file.mimeType
                            ? file.mimeType.split("/")[1]?.toUpperCase() ||
                              file.mimeType.toUpperCase()
                            : "UNKNOWN"}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatFileSize(file.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      {files.length === maxFiles && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <span>Maximum number of files uploaded</span>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <DialogTitle className="flex flex-col items-center gap-2 text-center">
              <div
                className="max-w-lg truncate text-lg font-semibold"
                title={previewImage?.originalName || previewImage?.name}
              >
                {previewImage?.originalName || previewImage?.name}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="font-medium">
                  {previewImage?.mimeType
                    ? previewImage.mimeType.split("/")[1]?.toUpperCase() ||
                      previewImage.mimeType.toUpperCase()
                    : "UNKNOWN"}
                </Badge>
                <span className="text-muted-foreground font-medium">
                  {previewImage && formatFileSize(previewImage.fileSize)}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Zoom Controls */}
          <div className="flex justify-center gap-2 px-6 py-3 border-b bg-background/95">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="h-8 w-8 p-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetZoomAndPosition()}
              className="h-8 px-3 text-xs"
            >
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 5}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="flex-1 flex items-center justify-center bg-muted/20 min-h-0 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={imageRef}
              className={cn(
                "relative flex items-center justify-center max-w-full max-h-full",
                "cursor-move"
              )}
              onMouseDown={handleMouseDown}
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${
                  position.y / zoom
                }px)`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
              }}
            >
              {previewImage && (
                <Image
                  src={previewImage.url}
                  alt={previewImage.name}
                  width={0}
                  height={0}
                  className="max-w-[80vw] max-h-[60vh] w-auto h-auto object-contain select-none"
                  sizes="80vw"
                  priority
                  draggable={false}
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: "80vw",
                    maxHeight: "60vh",
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex justify-between items-center p-4 border-t bg-background/95">
            <div className="text-sm text-muted-foreground">
              Click and drag to pan the image • Use zoom controls to zoom in/out
            </div>
            <Button
              variant="destructive"
              size="default"
              onClick={() => {
                if (previewImage) {
                  void removeFile(previewImage.id);
                  setPreviewImage(null);
                }
              }}
              disabled={disabled}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Image
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
