// Migra los estatus de solicitudes al flujo simplificado.
//
//   Normales (solicitudes):            recibida -> en_revision
//                                       aprobada -> concluida (apoyoRecibido = true)
//                                       requiere_informacion con reasignación pendiente -> reasignacion_solicitada
//   Secretaría (solicitudes_secretaria): recibida -> enviada (era su estatus inicial)
//                                       en_atencion -> en_revision
//                                       atendida -> concluida
//
// Uso (desde la raíz de jornadas-mobile, con APPWRITE_API_KEY en .env):
//   node scripts/appwrite/migrate-statuses.mjs            -> solo muestra lo que haría
//   node scripts/appwrite/migrate-statuses.mjs --apply    -> amplía los enums y migra los registros
//   node scripts/appwrite/migrate-statuses.mjs --narrow   -> después de migrar, deja los enums solo con los estatus vigentes
//
// Orden de despliegue: 1) --apply  2) desplegar identity-api, panel y app  3) --narrow
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const APPLY = process.argv.includes("--apply");
const NARROW = process.argv.includes("--narrow");

async function loadEnv(file) {
  const text = await fs.readFile(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

await loadEnv(path.join(process.cwd(), ".env"));

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey)
  throw new Error("Faltan EXPO_PUBLIC_APPWRITE_ENDPOINT, EXPO_PUBLIC_APPWRITE_PROJECT_ID o APPWRITE_API_KEY en .env");

const databaseId = "jornadas";
const headers = { "Content-Type": "application/json", "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey };

async function request(method, route, body) {
  const response = await fetch(`${endpoint}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${method} ${route}: ${response.status} ${data.message ?? text}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const q = (method, attribute, values) => encodeURIComponent(JSON.stringify(attribute ? { method, attribute, values } : { method, values }));

async function listByStatus(collectionId, statuses) {
  const docs = [];
  let cursor;
  for (;;) {
    const queries = [q("equal", "estatus", statuses), q("limit", null, [100])];
    if (cursor) queries.push(q("cursorAfter", null, [cursor]));
    const page = await request("GET", `/databases/${databaseId}/collections/${collectionId}/documents?${queries.map((x) => `queries[]=${x}`).join("&")}`);
    docs.push(...page.documents);
    if (page.documents.length < 100) return docs;
    cursor = page.documents.at(-1).$id;
  }
}

const parseJson = (text) => { try { return JSON.parse(text || "{}"); } catch { return {}; } };

// ---------------------------------------------------------------- ENUMS
const FINAL = {
  solicitudes: ["enviada", "en_revision", "requiere_informacion", "reasignacion_solicitada", "rechazada", "cancelada", "concluida"],
  solicitudes_secretaria: ["enviada", "pendiente_canalizacion", "canalizada", "en_revision", "requiere_informacion", "concluida", "cancelada"],
};

async function waitAvailable(collectionId) {
  for (let i = 0; i < 60; i++) {
    const attr = await request("GET", `/databases/${databaseId}/collections/${collectionId}/attributes/estatus`);
    if (attr.status === "available") return attr;
    if (attr.status === "failed") throw new Error(`El atributo estatus de ${collectionId} quedó en estado failed: ${attr.error || ""}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Tiempo agotado esperando el atributo estatus de ${collectionId}`);
}

async function setEnum(collectionId, elements) {
  const attr = await request("GET", `/databases/${databaseId}/collections/${collectionId}/attributes/estatus`);
  const same = attr.elements.length === elements.length && elements.every((value) => attr.elements.includes(value));
  if (same) { console.log(`  ${collectionId}.estatus ya tiene los valores esperados`); return; }
  console.log(`  ${collectionId}.estatus: [${attr.elements.join(", ")}]\n    -> [${elements.join(", ")}]`);
  if (!APPLY && !NARROW) return;
  const defaultValue = attr.default && elements.includes(attr.default) ? attr.default : null;
  await request("PATCH", `/databases/${databaseId}/collections/${collectionId}/attributes/enum/estatus`, {
    elements, required: attr.required, default: attr.required ? null : defaultValue,
  });
  await waitAvailable(collectionId);
}

// ---------------------------------------------------------------- MIGRACION
async function migrate(collectionId, from, toFor, extraData) {
  const docs = await listByStatus(collectionId, from);
  const summary = {};
  for (const doc of docs) {
    const to = toFor(doc);
    if (!to) continue;
    const key = `${doc.estatus} -> ${to}`;
    summary[key] = (summary[key] || 0) + 1;
    if (!APPLY) continue;
    const data = { estatus: to, ...(extraData ? extraData(doc, to) : {}) };
    try {
      await request("PATCH", `/databases/${databaseId}/collections/${collectionId}/documents/${doc.$id}`, { data });
    } catch (error) {
      // apoyoRecibido puede no existir como atributo en instalaciones viejas: se guarda solo en datosTramite.
      if (!("apoyoRecibido" in data)) throw error;
      delete data.apoyoRecibido;
      await request("PATCH", `/databases/${databaseId}/collections/${collectionId}/documents/${doc.$id}`, { data });
    }
  }
  const lines = Object.entries(summary);
  console.log(`  ${collectionId}: ${lines.length ? lines.map(([k, n]) => `${k} (${n})`).join(", ") : "nada que migrar"}`);
}

const needsReassignment = (doc) => doc.requiereReasignacion || parseJson(doc.datosTramite).__seguimiento?.requiereReasignacion;

console.log(APPLY ? "MODO: aplicar cambios\n" : NARROW ? "MODO: reducir enums\n" : "MODO: prueba (no se cambia nada; usa --apply para aplicar)\n");

if (NARROW) {
  const leftovers = [
    ...(await listByStatus("solicitudes", ["borrador", "recibida", "aprobada"])),
    ...(await listByStatus("solicitudes_secretaria", ["recibida", "en_atencion", "atendida"])),
  ];
  if (leftovers.length) throw new Error(`Aún hay ${leftovers.length} registros con estatus anteriores. Corre primero --apply.`);
  console.log("1) Enums con solo los estatus vigentes");
  await setEnum("solicitudes", FINAL.solicitudes);
  await setEnum("solicitudes_secretaria", FINAL.solicitudes_secretaria);
  console.log("\nListo.");
  process.exit(0);
}

console.log("1) Agregar los estatus nuevos a los enums (sin quitar los anteriores todavía)");
for (const collectionId of Object.keys(FINAL)) {
  const attr = await request("GET", `/databases/${databaseId}/collections/${collectionId}/attributes/estatus`);
  await setEnum(collectionId, [...new Set([...attr.elements, ...FINAL[collectionId]])]);
}

console.log("\n2) Migrar registros");
await migrate(
  "solicitudes",
  ["recibida", "aprobada", "requiere_informacion"],
  (doc) => doc.estatus === "recibida" ? "en_revision" : doc.estatus === "aprobada" ? "concluida" : needsReassignment(doc) ? "reasignacion_solicitada" : null,
  (doc, to) => {
    if (to !== "concluida") return {};
    const datos = parseJson(doc.datosTramite);
    const seguimiento = datos.__seguimiento || {};
    const apoyoRecibido = typeof seguimiento.apoyoRecibido === "boolean" ? seguimiento.apoyoRecibido : true;
    return {
      apoyoRecibido,
      datosTramite: JSON.stringify({ ...datos, __seguimiento: { ...seguimiento, apoyoRecibido, resultadoFinal: seguimiento.resultadoFinal || "Concluida" } }),
    };
  },
);
await migrate(
  "solicitudes_secretaria",
  ["recibida", "en_atencion", "atendida"],
  (doc) => ({ recibida: "enviada", en_atencion: "en_revision", atendida: "concluida" })[doc.estatus],
);

const borradores = await listByStatus("solicitudes", ["borrador"]);
if (borradores.length) console.log(`\n⚠ Hay ${borradores.length} solicitud(es) en "borrador"; revísalas a mano antes de --narrow: ${borradores.map((d) => d.folio || d.$id).join(", ")}`);

console.log(APPLY ? "\nListo. Despliega identity-api, el panel y la app; después corre --narrow." : "\nPrueba terminada. Si todo se ve bien, corre con --apply.");
