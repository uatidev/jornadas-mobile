// SOLO LECTURA: busca eventos_atencion con prefijoFolio repetido o vacío.
// Ejecutar antes de crear el índice único prefijo_folio_unique (provision.mjs).
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envText = await fs.readFile(path.join(root, ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) throw new Error("Falta la configuración de Appwrite en .env");

const documents = [];
let cursor = "";
while (true) {
  const queries = [{ method: "limit", values: [500] }];
  if (cursor) queries.push({ method: "cursorAfter", values: [cursor] });
  const params = queries.map((query) => `queries[]=${encodeURIComponent(JSON.stringify(query))}`).join("&");
  const response = await fetch(`${endpoint}/databases/jornadas/collections/eventos_atencion/documents?total=false&${params}`, {
    headers: { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
  });
  const page = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${page.message}`);
  documents.push(...page.documents);
  if (page.documents.length < 500) break;
  cursor = page.documents[page.documents.length - 1].$id;
}

const byFolio = new Map();
for (const item of documents) {
  const folio = String(item.prefijoFolio || "").trim();
  byFolio.set(folio, [...(byFolio.get(folio) || []), item]);
}

console.log(`Eventos revisados: ${documents.length}`);
let problems = 0;
for (const [folio, items] of byFolio) {
  if (folio && items.length === 1) continue;
  problems += 1;
  console.log(`\n${folio ? `Folio repetido "${folio}"` : "Sin folio"} (${items.length}):`);
  for (const item of items) console.log(`  - ${item.$id} · ${item.nombre} · ${item.municipio} · ${item.fechaInicio}`);
}
console.log(problems ? `\n${problems} problema(s). Corrígelos antes de crear el índice único.` : "\nSin duplicados: se puede crear el índice único.");
