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
const confirmed = process.argv.includes("--confirm");

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

// El orden evita dejar referencias de solicitudes o requisitos a documentos
// que ya no existen. Deliberadamente no incluye unidades ni usuarios.
const collections = [
  "documentos_solicitud",
  "historial_solicitud",
  "solicitudes",
  "folio_contadores",
  "eventos_atencion",
  "requisitos",
  "tramites_servicios",
];
const buckets = ["request-documents", "catalog-images"];

async function clearCollection(collectionId) {
  let affected = 0;
  while (true) {
    const result = await call(
      "GET",
      `/databases/${databaseId}/collections/${collectionId}/documents?total=false&queries[]=${limitQuery}`,
    );
    const documents = result.documents || [];
    if (!documents.length) break;
    affected += documents.length;
    if (!confirmed) break;
    for (const document of documents)
      await call(
        "DELETE",
        `/databases/${databaseId}/collections/${collectionId}/documents/${document.$id}`,
      );
  }
  console.log(`${collectionId}: ${affected} ${confirmed ? "eliminados" : "encontrados"}`);
}

async function clearBucket(bucketId) {
  let affected = 0;
  while (true) {
    const result = await call(
      "GET",
      `/storage/buckets/${bucketId}/files?total=false&queries[]=${limitQuery}`,
    );
    const files = result.files || [];
    if (!files.length) break;
    affected += files.length;
    if (!confirmed) break;
    for (const file of files)
      await call("DELETE", `/storage/buckets/${bucketId}/files/${file.$id}`);
  }
  console.log(`${bucketId}: ${affected} ${confirmed ? "eliminados" : "encontrados"}`);
}

for (const collectionId of collections) await clearCollection(collectionId);
for (const bucketId of buckets) await clearBucket(bucketId);

console.log(
  confirmed
    ? "Limpieza terminada. Las unidades y los usuarios se conservaron."
    : "Simulación terminada. No se eliminó nada; usa --confirm para ejecutar.",
);
