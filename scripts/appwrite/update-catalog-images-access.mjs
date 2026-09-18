import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const env = await fs.readFile(path.join(process.cwd(), ".env"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && !process.env[match[1]])
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) throw new Error("Falta la configuración de Appwrite");

const response = await fetch(`${endpoint}/storage/buckets/catalog-images`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey,
  },
  body: JSON.stringify({
    name: "Imágenes de programas y trámites",
    permissions: [
      'read("any")',
      'create("label:superadmin")',
      'update("label:superadmin")',
      'delete("label:superadmin")',
    ],
    fileSecurity: false,
    enabled: true,
    maximumFileSize: 10485760,
    allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
    compression: "gzip",
    encryption: true,
    antivirus: true,
  }),
});

if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
console.log("Acceso público de lectura aplicado a catalog-images.");
