import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const envText = await fs.readFile(path.join(process.cwd(), ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && !process.env[match[1]])
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) throw new Error("Falta la configuración de Appwrite");

const headers = {
  "content-type": "application/json",
  "x-appwrite-project": projectId,
  "x-appwrite-key": apiKey,
};
const response = await fetch(`${endpoint}/storage/buckets/request-documents/files?total=false`, { headers });
const result = await response.json();
if (!response.ok) throw new Error(result.message || "No fue posible listar los adjuntos");

const grants = ["superadmin", "secretaria", "capturistasecretaria", "gestor", "enlace", "capturista"]
  .map((label) => `read(\"label:${label}\")`);
let updated = 0;
for (const file of result.files || []) {
  const permissions = [...new Set([...(file.$permissions || []), ...grants])];
  const update = await fetch(
    `${endpoint}/storage/buckets/request-documents/files/${file.$id}`,
    { method: "PUT", headers, body: JSON.stringify({ permissions }) },
  );
  const body = await update.json();
  if (!update.ok) throw new Error(body.message || `No se pudo actualizar ${file.$id}`);
  updated += 1;
}
console.log(`Adjuntos actualizados: ${updated}`);
