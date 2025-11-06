import api from "./axios";
import { type UploadedFile } from "@/components/ui/image-upload";
import { ApiResponse } from "@/types/api";

export const filesAPI = {
  uploadImages: async (
    files: File[],
    filePath?: string,
    isPublic?: boolean
  ): Promise<ApiResponse<UploadedFile[]>> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    if (filePath) formData.append("filePath", filePath);
    formData.append("isPublic", String(isPublic ?? true));

    const response = await api.post("/api/files/upload/images", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Delete file
  deleteFile: async (fileId: string): Promise<ApiResponse<void>> => {
    const response = await api.delete(`/api/files/${fileId}`);
    return response.data;
  },

  // Get user files
  getUserFiles: async (
    fileType?: string
  ): Promise<ApiResponse<UploadedFile[]>> => {
    const params = fileType ? { fileType } : {};
    const response = await api.get("/api/files/my-files", { params });
    return response.data;
  },
};
