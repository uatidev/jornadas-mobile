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
const databaseId = "jornadas";
const dryRun = process.argv.includes("--dry-run");

if (!endpoint || !projectId || !apiKey)
  throw new Error("Falta la configuración administrativa de Appwrite en .env");

const headers = {
  "content-type": "application/json",
  "x-appwrite-project": projectId,
  "x-appwrite-key": apiKey,
};

async function call(method, route) {
  const response = await fetch(`${endpoint}${route}`, { method, headers });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!response.ok)
    throw new Error(`${method} ${route}: ${response.status} ${data.message || raw}`);
  return data;
}

const limitQuery = encodeURIComponent(
  JSON.stringify({ method: "limit", values: [100] }),
);
const collections = [
  "historial_solicitud",
  "documentos_solicitud",
  "solicitudes",
  "folio_contadores",
];

for (const collectionId of collections) {
  let affected = 0;
  while (true) {
    const result = await call(
      "GET",
      `/databases/${databaseId}/collections/${collectionId}/documents?total=false&queries[]=${limitQuery}`,
    );
    const documents = result.documents || [];
    if (!documents.length) break;
    affected += documents.length;
    if (dryRun) break;
    for (const document of documents) {
      await call(
        "DELETE",
        `/databases/${databaseId}/collections/${collectionId}/documents/${document.$id}`,
      );
    }
  }
  console.log(`${collectionId}: ${affected} ${dryRun ? "registros encontrados" : "registros eliminados"}`);
}

let affectedFiles = 0;
while (true) {
  const result = await call(
    "GET",
    `/storage/buckets/request-documents/files?total=false&queries[]=${limitQuery}`,
  );
  const files = result.files || [];
  if (!files.length) break;
  affectedFiles += files.length;
  if (dryRun) break;
  for (const file of files)
    await call("DELETE", `/storage/buckets/request-documents/files/${file.$id}`);
}
console.log(`request-documents: ${affectedFiles} ${dryRun ? "archivos encontrados" : "archivos eliminados"}`);
console.log(dryRun ? "Verificación terminada; no se eliminó información." : "Solicitudes reiniciadas correctamente.");
