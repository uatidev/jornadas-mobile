import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { File as ExpoFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Dimensions, Platform } from "react-native";

const { width: deviceWidth, height: deviceHeight } = Dimensions.get("window");

export const wp = (percentege: number) => {
  const width = deviceWidth;
  return (percentege * width) / 100;
};

export const hp = (percentege: number) => {
  const height = deviceHeight;
  return (percentege * height) / 100;
};

export interface INEScanResult {
  ine: File | { uri: string; name: string; type: string };
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  direccion: string;
  genero: "Masculino" | "Femenino" | "No Binario";
  edad: string;
  curp: string;
}

export const scanINEImage = async (
  file: File | { uri: string; name: string; type: string },
): Promise<string | null> => {
  // Obtener la API key desde variables de entorno
  const ocrApiKey =
    process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY ||
    Constants.expoConfig?.extra?.ocrSpaceApiKey ||
    process.env.VITE_OCR_SPACE_API_KEY ||
    "";

  if (!ocrApiKey) {
    throw new Error(
      "OCR Space API Key no configurada. Por favor configura EXPO_PUBLIC_OCR_SPACE_API_KEY en tu archivo .env",
    );
  }

  const formData = new FormData();

  formData.append("apikey", ocrApiKey);
  formData.append("language", "spa");
  formData.append("isOverlayRequired", "false");
  formData.append("OCREngine", "2");

  if (Platform.OS === "web") {
    formData.append("file", file as File);
  } else {
    const mobileFile = file as { uri: string; name: string; type: string };
    formData.append("file", new ExpoFile(mobileFile.uri), mobileFile.name);
  }

  try {
    const response = await expoFetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `El servicio OCR rechazó la imagen (${response.status}). Intenta nuevamente.`,
      );
    }

    const result = await response.json();

    if (result.IsErroredOnProcessing) {
      const detail = Array.isArray(result.ErrorMessage)
        ? result.ErrorMessage.join(" ")
        : result.ErrorMessage;
      throw new Error(detail || "El servicio OCR no pudo procesar la imagen");
    }

    const parsedText = result.ParsedResults?.[0]?.ParsedText || null;
    return parsedText;
  } catch (cause) {
    if (cause instanceof Error) throw cause;
    throw new Error("No fue posible conectar con el servicio OCR");
  }
};

export const compressImage = async (
  file: File | { uri: string; name: string; type: string },
  maxSizeInKB = 800,
): Promise<File | { uri: string; name: string; type: string }> => {
  try {
    if (Platform.OS === "web") {
      const webFile = file as File;

      // Crear una imagen para obtener dimensiones
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas context no disponible");

      return new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Calcular nuevas dimensiones manteniendo aspect ratio
            const maxDimension = 1200;
            let { width, height } = img;

            if (width > height) {
              if (width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;

            // Dibujar imagen comprimida
            ctx.drawImage(img, 0, 0, width, height);

            // Convertir a blob con calidad reducida
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], webFile.name, {
                    type: "image/jpeg",
                  });
                  resolve(compressedFile);
                } else {
                  reject(new Error("Error al comprimir imagen"));
                }
              },
              "image/jpeg",
              0.7, // Calidad reducida
            );
          } catch {
            reject(new Error("Error al comprimir imagen"));
          }
        };

        img.onerror = () => {
          reject(new Error("Error cargando imagen"));
        };

        img.src = URL.createObjectURL(webFile);
      });
    } else {
      const mobileFile = file as { uri: string; name: string; type: string };

      const result = await ImageManipulator.manipulateAsync(
        mobileFile.uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      return {
        uri: result.uri,
        name: mobileFile.name,
        type: "image/jpeg",
      };
    }
  } catch {
    // Si falla la compresión, devolver el archivo original
    return file;
  }
};

const calcularEdadDesdeFecha = (fechaStr: string): string => {
  if (!fechaStr) return "";

  try {
    const [dia, mes, año] = fechaStr.split("/").map(Number);
    const fechaNacimiento = new Date(año, mes - 1, dia);
    const hoy = new Date();
    const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mesActual = hoy.getMonth();
    const mesNacimiento = fechaNacimiento.getMonth();

    if (
      mesActual < mesNacimiento ||
      (mesActual === mesNacimiento && hoy.getDate() < fechaNacimiento.getDate())
    ) {
      return String(edad - 1);
    }

    return String(edad);
  } catch {
    return "";
  }
};

const extractCURPFromLines = (lines: string[]): string => {
  const curpRegex = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    const inline = line.match(curpRegex);
    if (inline) return inline[0];
    const next = lines[i + 1]?.toUpperCase() || "";
    const match = next.match(curpRegex);
    if (match) return match[0];
  }
  const fallback = lines.join(" ").match(curpRegex);
  return fallback?.[0] || "";
};

export const processINE = async (
  file: File | { uri: string; name: string; type: string },
): Promise<INEScanResult | null> => {
  try {
    const compressedFile = await compressImage(file, 800);
    const text = await scanINEImage(compressedFile);

    if (!text) {
      return null;
    }

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const indexNombre = lines.findIndex(
      (line) =>
        line.toUpperCase().includes("NOMBRE") ||
        line.toUpperCase().includes("N0MBRE"),
    );

    let apellidoPaterno = "";
    let apellidoMaterno = "";
    let nombre = "";

    if (indexNombre !== -1) {
      apellidoPaterno = lines[indexNombre + 1] || "";
      apellidoMaterno = lines[indexNombre + 2] || "";
      nombre = lines[indexNombre + 3] || "";
    }

    const direccionIndex = lines.findIndex(
      (line) =>
        line.toUpperCase().includes("DOMICILIO") ||
        line.toUpperCase().includes("DOMICIL"),
    );

    let direccion = "";
    if (direccionIndex !== -1) {
      direccion = [
        lines[direccionIndex + 1],
        lines[direccionIndex + 2],
        lines[direccionIndex + 3],
      ]
        .filter(Boolean)
        .join(" ");
    }

    const curp = extractCURPFromLines(lines);

    const fechaNacimiento =
      lines.find((line) => /^\d{2}\/\d{2}\/\d{4}$/.test(line)) ?? "";

    const sexoLine =
      lines
        .find((line) => line.toUpperCase().startsWith("SEXO"))
        ?.toUpperCase() || "";

    const sexo = sexoLine.includes("H")
      ? "Masculino"
      : sexoLine.includes("M")
        ? "Femenino"
        : "No Binario";

    const result = {
      ine: compressedFile, // Guardar la imagen comprimida
      nombre,
      primerApellido: apellidoPaterno,
      segundoApellido: apellidoMaterno,
      direccion,
      genero: sexo as "Masculino" | "Femenino" | "No Binario",
      edad: calcularEdadDesdeFecha(fechaNacimiento),
      curp,
    };

    return result;
  } catch (cause) {
    if (cause instanceof Error) throw cause;
    throw new Error("Error procesando INE");
  }
};
