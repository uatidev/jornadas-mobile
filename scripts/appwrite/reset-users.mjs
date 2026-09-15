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
const adminEmail = process.env.APPWRITE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const databaseId = "jornadas";
const dryRun = process.argv.includes("--dry-run");

if (!endpoint || !projectId || !apiKey || !adminEmail)
  throw new Error("Falta la configuración de Appwrite o el correo del Superadministrador inicial");

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

const equalEmail = encodeURIComponent(
  JSON.stringify({ method: "equal", attribute: "email", values: [adminEmail] }),
);
const adminResult = await call("GET", `/users?queries[]=${equalEmail}`);
const admin = adminResult.users?.[0];
if (!admin) throw new Error("No se encontró el Superadministrador inicial; no se eliminó ningún usuario");
if (!(admin.labels || []).includes("superadmin"))
  throw new Error("La cuenta protegida no tiene la etiqueta superadmin; no se eliminó ningún usuario");

const adminProfile = await call(
  "GET",
  `/databases/${databaseId}/collections/usuarios_perfil/documents/${admin.$id}`,
);
if (adminProfile.rol !== "super_admin" && adminProfile.rolSistema !== "super_admin")
  throw new Error("El perfil protegido no es Superadministrador; no se eliminó ningún usuario");

const limitQuery = encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }));
let affectedProfiles = 0;
while (true) {
  const result = await call(
    "GET",
    `/databases/${databaseId}/collections/usuarios_perfil/documents?total=false&queries[]=${limitQuery}`,
  );
  const removable = (result.documents || []).filter((profile) => profile.$id !== admin.$id);
  if (!removable.length) break;
  affectedProfiles += removable.length;
  if (dryRun) break;
  for (const profile of removable)
    await call("DELETE", `/databases/${databaseId}/collections/usuarios_perfil/documents/${profile.$id}`);
}

let affectedUsers = 0;
while (true) {
  const result = await call("GET", `/users?total=false&queries[]=${limitQuery}`);
  const removable = (result.users || []).filter((user) => user.$id !== admin.$id);
  if (!removable.length) break;
  affectedUsers += removable.length;
  if (dryRun) break;
  for (const user of removable)
    await call("DELETE", `/users/${user.$id}`);
}

console.log(`Superadministrador conservado: ${admin.email}`);
console.log(`usuarios_perfil: ${affectedProfiles} ${dryRun ? "perfiles encontrados" : "perfiles eliminados"}`);
console.log(`usuarios: ${affectedUsers} ${dryRun ? "cuentas encontradas" : "cuentas eliminadas"}`);
console.log(dryRun ? "Verificación terminada; no se eliminó información." : "Usuarios reiniciados correctamente.");
