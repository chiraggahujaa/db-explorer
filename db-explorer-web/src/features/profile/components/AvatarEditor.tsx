"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  User,
  Camera,
  Upload,
  AlertCircle,
  Trash2,
  BadgeCheck,
  Move,
} from "lucide-react";
import { cn } from "@/utils/ui";
import { filesAPI } from "@/lib/api/files";

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  fullName?: string;
  isVerified?: boolean;
  isEditing?: boolean;
  onAvatarChange?: (avatarUrl: string | null) => void;
  onUploadStart?: () => void;
  onUploadComplete?: (avatarUrl: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  filePath?: string;
}

interface ImagePosition {
  x: number;
  y: number;
  scale: number;
}

export function AvatarEditor({
  currentAvatarUrl,
  fullName,
  isVerified,
  isEditing = false,
  onAvatarChange,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled = false,
  className,
  filePath,
}: AvatarEditorProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentAvatarUrl || null
  );

  useEffect(() => {
    setAvatarUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl]);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<ImagePosition>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    imageX: 0,
    imageY: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);

  const initials =
    fullName
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const maxSizeBytes = useMemo(() => 5 * 1024 * 1024, []); // 5MB
  const acceptedFileTypes = useMemo(
    () => ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    []
  );

  const uploadFile = async (file: File): Promise<string> => {
    const result = await filesAPI.uploadImages([file], filePath, true);

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(
        result.message || "Upload failed - no file data returned"
      );
    }

    return result.data[0].url;
  };

  const createCroppedImage = async (
    imageSrc: string,
    position: ImagePosition
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.crossOrigin = "anonymous";
      img.onload = () => {
        const outputSize = 200; // Output size
        const previewSize = 192; // Preview container size (48 * 4 = 192px)

        canvas.width = outputSize;
        canvas.height = outputSize;

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.clip();

        // Calculate how the image fits in the preview container
        const imageAspectRatio = img.width / img.height;
        let previewImageWidth, previewImageHeight;

        if (imageAspectRatio > 1) {
          // Image is wider than tall
          previewImageHeight = previewSize;
          previewImageWidth = previewSize * imageAspectRatio;
        } else {
          // Image is taller than wide or square
          previewImageWidth = previewSize;
          previewImageHeight = previewSize / imageAspectRatio;
        }

        // Apply scaling
        const scaledPreviewWidth = previewImageWidth * position.scale;
        const scaledPreviewHeight = previewImageHeight * position.scale;

        // Calculate the ratio between output and preview
        const ratio = outputSize / previewSize;

        // Scale everything up for the final output
        const finalWidth = scaledPreviewWidth * ratio;
        const finalHeight = scaledPreviewHeight * ratio;
        const finalX = position.x * ratio;
        const finalY = position.y * ratio;

        // Draw the image centered with the applied transformations
        ctx.drawImage(
          img,
          finalX + (outputSize - finalWidth) / 2,
          finalY + (outputSize - finalHeight) / 2,
          finalWidth,
          finalHeight
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error("Failed to create cropped image"));
            }
          },
          "image/png",
          0.9
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageSrc;
    });
  };

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || acceptedFiles.length === 0) return;

      const file = acceptedFiles[0]; // Only take the first file for avatar
      setError(null);

      // Validate file
      if (!acceptedFileTypes.includes(file.type)) {
        const errorMsg = `File type ${file.type} is not supported. Please use JPEG, JPG, PNG, or WebP.`;
        setError(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      if (file.size > maxSizeBytes) {
        const errorMsg = `File size exceeds ${Math.round(
          maxSizeBytes / 1024 / 1024
        )}MB limit.`;
        setError(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      // Create preview URL and show crop dialog
      const previewUrl = URL.createObjectURL(file);
      setTempImageUrl(previewUrl);
      setImagePosition({ x: 0, y: 0, scale: 1 });
      setShowCropDialog(true);
    },
    [disabled, acceptedFileTypes, maxSizeBytes, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: {
      "image/*": acceptedFileTypes.map((type) => type.replace("image/", ".")),
    },
    disabled,
    maxFiles: 1,
    multiple: false,
  });

  const handleCropSave = async () => {
    if (!tempImageUrl) return;

    setUploading(true);
    setUploadProgress(0);
    onUploadStart?.();

    try {
      // Create cropped image
      const croppedImageUrl = await createCroppedImage(
        tempImageUrl,
        imagePosition
      );

      // Convert blob URL to file
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], "avatar.png", { type: "image/png" });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const newAvatarUrl = await uploadFile(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Automatically set the new avatar URL
      setAvatarUrl(newAvatarUrl);
      onAvatarChange?.(newAvatarUrl);
      onUploadComplete?.(newAvatarUrl);

      // Clean up
      URL.revokeObjectURL(tempImageUrl);
      URL.revokeObjectURL(croppedImageUrl);
      setTempImageUrl(null);
      setShowCropDialog(false);

      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (tempImageUrl) {
      URL.revokeObjectURL(tempImageUrl);
    }
    setTempImageUrl(null);
    setShowCropDialog(false);
    setImagePosition({ x: 0, y: 0, scale: 1 });
  };

  const handleRemoveAvatar = () => {
    if (disabled) return;

    setAvatarUrl(null);
    onAvatarChange?.(null);
    setError(null);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!showCropDialog) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      imageX: imagePosition.x,
      imageY: imagePosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !showCropDialog) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setImagePosition((prev) => ({
      ...prev,
      x: dragStart.imageX + deltaX,
      y: dragStart.imageY + deltaY,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isEditing) {
    // View mode
    return (
      <Card className={cn("w-full max-w-[280px] sm:max-w-[320px]", className)}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2">
            <User className="h-4 w-4" />
            Profile Photo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 border-4 border-muted">
                <AvatarImage
                  src={avatarUrl || undefined}
                  alt={fullName || "User avatar"}
                />
                <AvatarFallback className="text-2xl bg-muted">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {isVerified && (
                <Badge
                  variant="default"
                  className="absolute -bottom-1 -right-1 rounded-full p-1 bg-blue-500 hover:bg-blue-600"
                >
                  <BadgeCheck className="h-3 w-3" />
                </Badge>
              )}
            </div>

            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <p className="font-medium text-lg">
                  {fullName || "Anonymous User"}
                </p>
                {/* {isVerified && <BadgeCheck className="h-4 w-4 text-blue-500" />} */}
              </div>
              {isEditing ? (
                <p className="text-sm text-muted-foreground">
                  {avatarUrl ? "Profile photo uploaded" : "No profile photo"}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <>
      <Card className={cn("w-full max-w-xs sm:max-w-sm", className)}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2">
            <User className="h-4 w-4" />
            Profile Photo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            {/* Avatar with Drag & Drop */}
            <div className="relative">
              <div
                {...getRootProps()}
                className={cn(
                  "relative cursor-pointer transition-all duration-200",
                  isDragActive && "scale-105"
                )}
              >
                <input {...getInputProps()} />
                <Avatar
                  className={cn(
                    "h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 border-4 transition-all duration-200",
                    isDragActive
                      ? "border-primary border-dashed"
                      : "border-muted",
                    !avatarUrl && "bg-muted/50"
                  )}
                >
                  <AvatarImage
                    src={avatarUrl || undefined}
                    alt={fullName || "User avatar"}
                  />
                  <AvatarFallback className="text-2xl bg-muted">
                    {isDragActive ? (
                      <Upload className="h-8 w-8 text-muted-foreground animate-bounce" />
                    ) : (
                      initials
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Upload overlay */}
                {isDragActive && (
                  <div className="absolute inset-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary animate-bounce" />
                  </div>
                )}
              </div>

              {isVerified && (
                <Badge
                  variant="default"
                  className="absolute -bottom-1 -right-1 rounded-full p-1 bg-blue-500 hover:bg-blue-600"
                >
                  <BadgeCheck className="h-3 w-3" />
                </Badge>
              )}
            </div>

            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <p className="font-medium text-lg">
                  {fullName || "Anonymous User"}
                </p>
                {isVerified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
              </div>

              <p className="text-xs text-muted-foreground">
                {isDragActive
                  ? "Drop image here"
                  : "Drag & drop image or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP • Max 5MB
              </p>
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleButtonClick}
              disabled={disabled || uploading}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              Browse
            </Button>
            {avatarUrl && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={disabled || uploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>

        {/* Hidden file input for button clicks */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              handleFiles(files);
            }
          }}
          accept={acceptedFileTypes.join(",")}
          className="hidden"
          disabled={disabled}
        />
      </Card>

      {/* Crop/Position Dialog */}
      <Dialog open={showCropDialog} onOpenChange={handleCropCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-4 w-4" />
              Position Your Photo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Crop Preview */}
            <div className="flex justify-center">
              <div
                className="relative w-48 h-48 rounded-full border-4 border-muted overflow-hidden bg-muted cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {tempImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={cropImageRef}
                    src={tempImageUrl}
                    alt="Crop preview"
                    className="absolute select-none pointer-events-none max-w-none"
                    style={{
                      transform: `translate(calc(-50% + ${imagePosition.x}px), calc(-50% + ${imagePosition.y}px)) scale(${imagePosition.scale})`,
                      left: "50%",
                      top: "50%",
                      height: "192px", // Match previewSize in calculation
                      width: "auto",
                    }}
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      const aspectRatio = img.naturalWidth / img.naturalHeight;
                      if (aspectRatio > 1) {
                        // Wide image
                        img.style.width = `${192 * aspectRatio}px`;
                        img.style.height = "192px";
                      } else {
                        // Tall or square image
                        img.style.width = "192px";
                        img.style.height = `${192 / aspectRatio}px`;
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Scale Control */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zoom</label>
              <Slider
                value={[imagePosition.scale]}
                onValueChange={(value) =>
                  setImagePosition((prev) => ({ ...prev, scale: value[0] }))
                }
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Drag the image to reposition • Use slider to zoom
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCropCancel}
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropSave}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Photo"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
