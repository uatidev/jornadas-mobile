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
if (!endpoint || !projectId || !apiKey)
  throw new Error("Falta la configuración administrativa de Appwrite en .env");

const headers = {
  "content-type": "application/json",
  "x-appwrite-project": projectId,
  "x-appwrite-key": apiKey,
};

const attributes = [
  ["unidades_administrativas", "telefonoContacto", 30],
  ["unidades_administrativas", "extensionTelefono", 12],
  ["tramites_servicios", "extensionTelefono", 12],
];

for (const [collection, key, size] of attributes) {
  const response = await fetch(
    `${endpoint}/databases/jornadas/collections/${collection}/attributes/string`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ key, size, required: false, array: false }),
    },
  );
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (response.ok) console.log(`${collection}.${key}: creado`);
  else if (response.status === 409) console.log(`${collection}.${key}: ya existe`);
  else throw new Error(`${collection}.${key}: ${data.message || raw}`);
}
