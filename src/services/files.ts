import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import {
  APPWRITE_CONFIG,
  getAppwriteConfig,
  getAppwriteStorage,
  ID,
} from "./appwrite";

// Mantener compatibilidad con el tipo FileUploadResponse existente
export interface FileUploadResponse {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
}

class FilesService {
  private getBucketId(
    bucketType: "images" | "ine_images" | "catalog_images" | "request_documents" = "images",
  ): string {
    return bucketType === "request_documents"
      ? APPWRITE_CONFIG.STORAGE_BUCKETS.REQUEST_DOCUMENTS
      : bucketType === "catalog_images"
      ? APPWRITE_CONFIG.STORAGE_BUCKETS.CATALOG_IMAGES
      : bucketType === "ine_images"
        ? APPWRITE_CONFIG.STORAGE_BUCKETS.INE_IMAGES
        : APPWRITE_CONFIG.STORAGE_BUCKETS.IMAGES;
  }

  async uploadImage(
    file: File | { uri: string; name: string; type: string },
    bucketType: "images" | "ine_images" | "catalog_images" | "request_documents" = "images",
  ): Promise<FileUploadResponse> {
    try {
      // Verificar autenticación antes de intentar subir
      const { getAppwriteAccount } = await import("./appwrite");
      try {
        const account = getAppwriteAccount();
        await account.get();
      } catch (authError: any) {
        throw new Error(
          `No estás autenticado: ${authError?.message || "Por favor inicia sesión nuevamente"}`,
        );
      }

      const storage = getAppwriteStorage();
      const bucketId = this.getBucketId(bucketType);
      const fileId = ID.unique();

      // Preparar el archivo exactamente como en promocion-turistica
      let fileData: File | ExpoFile;

      if (Platform.OS === "web") {
        if (file instanceof File) {
          fileData = file;
        } else {
          // En web con URI, convertir a File
          const fileObj = file as { uri: string; name: string; type: string };
          if (!fileObj.uri) {
            throw new Error("La imagen no contiene URI válida");
          }
          const response = await fetch(fileObj.uri);
          const blob = await response.blob();
          const type = blob.type || fileObj.type || "image/jpeg";
          const fileName = fileObj.name || `${fileId}.jpg`;
          fileData = new File([blob], fileName, { type });
        }
      } else {
        // Expo SDK 57 usa un FormData que requiere Blob/bytes. ExpoFile implementa
        // ambos y evita "Unsupported FormDataPart implementation" en iOS.
        const fileObj = file as { uri: string; name: string; type: string };
        if (!fileObj.uri) {
          throw new Error("La imagen no contiene URI válida");
        }
        fileData = new ExpoFile(fileObj.uri);
      }

      // Subir archivo a Appwrite Storage
      let response: any;
      try {
        // Llamar a createFile directamente
        // En iOS, asegurarse de que el formato sea correcto
        const fileToUpload =
          Platform.OS === "ios" &&
          typeof fileData === "object" &&
          "uri" in fileData
            ? fileData
            : fileData;

        try {
          response = await storage.createFile(
            bucketId,
            fileId,
            fileToUpload as any,
          );
        } catch (createFileError: any) {
          throw createFileError;
        }
      } catch (createError: any) {
        throw new Error(
          `Error al subir el archivo: ${createError?.message || createError?.code || "Error desconocido"}`,
        );
      }

      if (!response || !response.$id) {
        // Mensaje de error más descriptivo
        const errorMessage = `Error al subir la imagen: el servidor no retornó una respuesta válida.
        
Posibles causas:
- El bucket '${bucketId}' no existe o no tienes permisos de escritura
- El formato del archivo no es compatible con react-native-appwrite
- Problema de conexión con el servidor de Appwrite

Bucket ID: ${bucketId}
File ID: ${fileId}
Plataforma: ${Platform.OS}
Formato archivo: ${Platform.OS === "web" ? "File web" : "ExpoFile nativo"}`;

        throw new Error(errorMessage);
      }

      // Construir la URL del archivo usando el mismo método que getImageUrl
      const { endpoint, projectId } = getAppwriteConfig();

      const fileUrl = `${endpoint}/storage/buckets/${bucketId}/files/${response.$id}/view?project=${projectId}`;

      const fileName =
        Platform.OS === "web" && file instanceof File
          ? file.name
          : (file as { uri: string; name: string; type: string }).name ||
            `${fileId}.jpg`;

      return {
        filename: response.$id,
        originalname: fileName,
        mimetype:
          response.mimeType ||
          (Platform.OS === "web" && fileData instanceof File
            ? fileData.type
            : (file as { uri: string; name: string; type: string }).type) ||
          "image/jpeg",
        size: response.sizeOriginal || 0,
        url: fileUrl,
      };
    } catch (error: any) {
      throw new Error(error.message || "Error al subir la imagen");
    }
  }

  async uploadMultipleImages(
    files: (File | { uri: string; name: string; type: string })[],
    bucketType: "images" | "ine_images" | "catalog_images" | "request_documents" = "images",
  ): Promise<FileUploadResponse[]> {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadImage(file, bucketType),
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      throw error;
    }
  }

  async openAuthenticatedFile(
    fileId: string,
    mimeType = "application/octet-stream",
  ): Promise<void> {
    if (Platform.OS !== "web")
      throw new Error("La visualización administrativa de adjuntos está disponible en la versión web");
    const opened = window.open("about:blank", "_blank");
    if (!opened)
      throw new Error("El navegador bloqueó la ventana. Permite ventanas emergentes para visualizar el archivo");
    opened.opener = null;
    try {
      const bytes = await getAppwriteStorage().getFileView({
        bucketId: APPWRITE_CONFIG.STORAGE_BUCKETS.REQUEST_DOCUMENTS,
        fileId,
      });
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      opened.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (cause) {
      opened.close();
      throw cause;
    }
  }

  getImageUrl(
    fileId: string,
    bucketType: "images" | "ine_images" | "catalog_images" | "request_documents" = "images",
  ): string {
    const bucketId = this.getBucketId(bucketType);

    const { endpoint, projectId } = getAppwriteConfig();

    // Validar que tengamos endpoint y projectId
    if (!endpoint || !projectId) {
      console.error("getImageUrl - Faltan endpoint o projectId:", {
        endpoint,
        projectId,
      });
      throw new Error(
        "Appwrite configuration is missing endpoint or projectId",
      );
    }

    const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
    console.log("getImageUrl - URL generada:", url);
    return url;
  }

  async deleteImage(
    fileId: string,
    bucketType: "images" | "ine_images" | "catalog_images" = "images",
  ): Promise<void> {
    try {
      const storage = getAppwriteStorage();
      const bucketId = this.getBucketId(bucketType);

      await storage.deleteFile(bucketId, fileId);
    } catch (error: any) {
      throw new Error(error.message || "Error al eliminar la imagen");
    }
  }
}

export const filesService = new FilesService();
