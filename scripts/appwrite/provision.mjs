import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

async function loadEnv(file) {
  const text = await fs.readFile(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

await loadEnv(path.join(root, ".env"));

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.replace(/\/$/, "");
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey)
  throw new Error(
    "Faltan EXPO_PUBLIC_APPWRITE_ENDPOINT, EXPO_PUBLIC_APPWRITE_PROJECT_ID o APPWRITE_API_KEY en .env",
  );

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
};

async function request(method, route, body) {
  const response = await fetch(`${endpoint}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(
      `${method} ${route}: ${response.status} ${data.message ?? text}`,
    );
    error.status = response.status;
    error.type = data.type;
    throw error;
  }
  return data;
}

async function ensure(label, create, get) {
  try {
    const existing = await get();
    console.log(`= ${label}`);
    return existing;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const created = await create();
  console.log(`+ ${label}`);
  return created;
}

const databaseId = "jornadas";
// Appwrite exige identificadores de label estrictamente alfanuméricos.
// El valor de negocio guardado en usuarios_perfil sigue siendo `super_admin`.
const superAdmin = "label:superadmin";
const enlace = "label:enlace";
const capturista = "label:capturista";
const solicitante = "label:solicitante";
const read = (role) => `read(\"${role}\")`;
const create = (role) => `create(\"${role}\")`;
const update = (role) => `update(\"${role}\")`;
const del = (role) => `delete(\"${role}\")`;

await ensure(
  "database jornadas",
  () =>
    request("POST", "/databases", {
      databaseId,
      name: "Jornadas de Atención",
      enabled: true,
    }),
  () => request("GET", `/databases/${databaseId}`),
);

await ensure(
  "bucket catalog-images",
  () =>
    request("POST", "/storage/buckets", {
      bucketId: "catalog-images",
      name: "Imágenes de programas y trámites",
      permissions: [
        read("any"),
        create(superAdmin),
        update(superAdmin),
        del(superAdmin),
      ],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 10485760,
      allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
      compression: "gzip",
      encryption: true,
      antivirus: true,
    }),
  () => request("GET", "/storage/buckets/catalog-images"),
);

// Las tarjetas móviles consumen las imágenes mediante URL directa. React
// Native Image en iOS no adjunta la sesión de Appwrite a esa petición.
await request("PUT", "/storage/buckets/catalog-images", {
  name: "Imágenes de programas y trámites",
  permissions: [
    read("any"),
    create(superAdmin),
    update(superAdmin),
    del(superAdmin),
  ],
  fileSecurity: false,
  enabled: true,
  maximumFileSize: 10485760,
  allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
  compression: "gzip",
  encryption: true,
  antivirus: true,
});

await ensure(
  "bucket request-documents",
  () =>
    request("POST", "/storage/buckets", {
      bucketId: "request-documents",
      name: "Documentos de solicitudes",
      permissions: [
        read("users"),
        create("users"),
        update(superAdmin),
        del(superAdmin),
      ],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 15728640,
      allowedFileExtensions: ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"],
      compression: "gzip",
      encryption: true,
      antivirus: true,
    }),
  () => request("GET", "/storage/buckets/request-documents"),
);

const collections = [
  {
    id: "unidades_administrativas",
    name: "Unidades administrativas",
    permissions: [
      read("users"),
      create(superAdmin),
      update(superAdmin),
      del(superAdmin),
    ],
  },
  {
    id: "usuarios_perfil",
    name: "Perfiles de usuario",
    permissions: [create(superAdmin), update(superAdmin), del(superAdmin)],
    documentSecurity: true,
  },
  {
    id: "tramites_servicios",
    name: "Trámites y servicios",
    permissions: [
      read("users"),
      create(superAdmin),
      update(superAdmin),
      del(superAdmin),
    ],
  },
  {
    id: "requisitos",
    name: "Requisitos",
    permissions: [
      read("users"),
      create(superAdmin),
      update(superAdmin),
      del(superAdmin),
    ],
  },
  {
    id: "solicitudes",
    name: "Solicitudes",
    permissions: [create(solicitante), create(enlace), create(superAdmin)],
    documentSecurity: true,
  },
  {
    id: "solicitudes_secretaria",
    name: "Solicitudes de atención de Secretaria",
    permissions: [],
    documentSecurity: true,
  },
  {
    id: "documentos_solicitud",
    name: "Documentos de solicitud",
    permissions: [],
    documentSecurity: true,
  },
  {
    id: "historial_solicitud",
    name: "Historial de solicitudes",
    permissions: [],
    documentSecurity: true,
  },
  {
    id: "folio_contadores",
    name: "Contadores de folios",
    permissions: [],
    documentSecurity: false,
  },
  {
    id: "configuracion_formulario_global",
    name: "Configuración del formulario global",
    permissions: [
      read("users"),
      create(superAdmin),
      update(superAdmin),
      del(superAdmin),
    ],
  },
  {
    id: "eventos_atencion",
    name: "Eventos de atención",
    permissions: [
      read("users"),
      create(superAdmin),
      update(superAdmin),
      del(superAdmin),
    ],
  },
];

for (const col of collections) {
  await ensure(
    `collection ${col.id}`,
    () =>
      request("POST", `/databases/${databaseId}/collections`, {
        collectionId: col.id,
        name: col.name,
        permissions: col.permissions,
        documentSecurity: col.documentSecurity ?? false,
        enabled: true,
      }),
    () => request("GET", `/databases/${databaseId}/collections/${col.id}`),
  );
}

const attr = {
  string: (key, size, required = true, defaultValue, array = false) => ({
    type: "string",
    key,
    size,
    required,
    default: defaultValue,
    array,
  }),
  enum: (key, elements, required = true, defaultValue, array = false) => ({
    type: "enum",
    key,
    elements,
    required,
    default: defaultValue,
    array,
  }),
  boolean: (key, required = true, defaultValue) => ({
    type: "boolean",
    key,
    required,
    default: defaultValue,
  }),
  integer: (key, required = true, min, max, defaultValue) => ({
    type: "integer",
    key,
    required,
    min,
    max,
    default: defaultValue,
  }),
  datetime: (key, required = true, defaultValue) => ({
    type: "datetime",
    key,
    required,
    default: defaultValue,
  }),
  float: (key, required = true, min, max, defaultValue) => ({
    type: "float",
    key,
    required,
    min,
    max,
    default: defaultValue,
  }),
};

const schemas = {
  unidades_administrativas: [
    attr.string("clave", 32),
    attr.string("nombre", 160),
    attr.string("descripcion", 1000, false),
    attr.string("titular", 160, false),
    attr.string("correoContacto", 254, false),
    attr.string("telefonoContacto", 30, false),
    attr.string("extensionTelefono", 12, false),
    attr.string("teamId", 64),
    attr.boolean("activo", false, true),
  ],
  usuarios_perfil: [
    attr.string("userId", 64),
    attr.string("email", 254),
    attr.string("nombre", 200),
    attr.enum("rol", ["super_admin", "enlace", "solicitante"]),
    attr.string("rolSistema", 32, false),
    attr.string("unidadAdministrativaId", 64, false),
    attr.boolean("activo", false, true),
  ],
  tramites_servicios: [
    attr.string("unidadAdministrativaId", 64),
    attr.enum("tipo", ["tramite", "servicio", "programa"]),
    attr.string("clave", 40),
    attr.string("nombre", 180),
    attr.string("descripcion", 3000),
    attr.string("poblacionObjetivo", 2000, false),
    attr.string("costo", 100, false, "Gratuito"),
    attr.datetime("vigenciaInicio", false),
    attr.datetime("vigenciaFin", false),
    attr.boolean("activo", false, true),
    attr.integer("orden", false, 0, 10000, 0),
    attr.string("configuracionFormulario", 8000, false),
    attr.boolean("usaFolioPrograma", false, false),
    attr.string("prefijoFolioPrograma", 32, false),
    attr.boolean("usaFormularioGlobal", false, true),
    attr.string("imagenFileId", 64, false),
    attr.string("imagenUrl", 1000, false),
    attr.string("titularResponsable", 200, false),
    attr.string("correoContacto", 254, false),
    attr.string("telefonoContacto", 30, false),
    attr.string("extensionTelefono", 12, false),
  ],
  requisitos: [
    attr.string("tramiteServicioId", 64),
    attr.string("nombre", 220),
    attr.string("descripcion", 2000, false),
    attr.string("tipoDocumento", 80, false),
    attr.boolean("obligatorio", false, true),
    attr.integer("orden", false, 0, 10000, 0),
    attr.boolean("activo", false, true),
  ],
  solicitudes: [
    attr.string("folio", 40),
    attr.string("tramiteServicioId", 64),
    attr.string("unidadAdministrativaId", 64),
    attr.string("solicitanteUserId", 64),
    attr.enum(
      "estatus",
      [
        "borrador",
        "enviada",
        "recibida",
        "en_revision",
        "requiere_informacion",
        "aprobada",
        "rechazada",
        "cancelada",
        "concluida",
      ],
      false,
      "enviada",
    ),
    attr.string("datosSolicitante", 8000),
    attr.string("datosTramite", 4000),
    attr.datetime("fechaSolicitud"),
    attr.string("asignadoAUserId", 64, false),
    attr.string("observaciones", 1500, false),
    attr.string("eventoAtencionId", 64, false),
    attr.string("folioEvento", 64, false),
    attr.string("folioPrograma", 80, false),
    attr.boolean("prioridadReapertura", false, false),
    attr.string("resultadoFinal", 80, false),
    attr.string("motivoNoContinuidad", 1500, false),
    attr.boolean("apoyoRecibido", false),
  ],
  solicitudes_secretaria: [
    attr.string("folio", 40),
    attr.string("datosSolicitante", 4000),
    attr.string("asunto", 300),
    attr.enum("procedencia", ["gobernador", "oficina_gubernamental", "otra"]),
    attr.string("numeroOficio", 100, false),
    attr.datetime("fechaOficio", false),
    attr.string("observaciones", 1000, false),
    attr.enum("rutaAtencion", ["secretaria", "canalizacion", "canalizada"]),
    attr.enum("estatus", ["recibida", "en_atencion", "requiere_informacion", "pendiente_canalizacion", "canalizada", "atendida", "cancelada"]),
    attr.string("capturadoPorUserId", 64),
    attr.string("capturadoPorNombre", 160),
    attr.boolean("capturadoEnNombreDeSecretaria", false, false),
    attr.boolean("prioridadAlta", false, true),
    attr.string("unidadResponsableId", 64, false),
    attr.string("eventoAtencionId", 64, false),
    attr.string("folioEvento", 64, false),
    attr.string("documentos", 4000, false),
    attr.datetime("fechaRegistro"),
    attr.datetime("fechaActualizacion"),
  ],
  documentos_solicitud: [
    attr.string("solicitudId", 64),
    attr.string("requisitoId", 64, false),
    attr.string("fileId", 64),
    attr.string("nombreArchivo", 255),
    attr.enum(
      "estatusValidacion",
      ["pendiente", "valido", "rechazado"],
      false,
      "pendiente",
    ),
    attr.string("observaciones", 2000, false),
  ],
  historial_solicitud: [
    attr.string("solicitudId", 64),
    attr.string("estatusAnterior", 40, false),
    attr.string("estatusNuevo", 40),
    attr.string("comentario", 4000, false),
    attr.string("realizadoPorUserId", 64),
    attr.datetime("fecha"),
  ],
  folio_contadores: [
    attr.string("periodo", 80),
    attr.integer("ultimo", false, 0, 999999999, 0),
  ],
  configuracion_formulario_global: [
    attr.string("nombre", 120),
    attr.integer("version", false, 1, 9999, 1),
    attr.string("campos", 8000),
    attr.boolean("activo", false, true),
  ],
  eventos_atencion: [
    attr.string("nombre", 200),
    attr.string("municipio", 80),
    attr.string("localidad", 160),
    attr.string("claveMunicipio", 24),
    attr.string("sede", 200),
    attr.string("direccion", 500),
    attr.datetime("fechaInicio"),
    attr.datetime("fechaFin"),
    attr.float("latitud", true, -90, 90),
    attr.float("longitud", true, -180, 180),
    attr.boolean("activo", false, true),
    attr.string("prefijoFolio", 32),
    attr.integer("capacidad", false, 0, 100000),
    attr.string("notas", 1500, false),
  ],
};

async function createAttribute(collectionId, definition) {
  const { type, ...body } = definition;
  await ensure(
    `attribute ${collectionId}.${body.key}`,
    () =>
      request(
        "POST",
        `/databases/${databaseId}/collections/${collectionId}/attributes/${type}`,
        body,
      ),
    () =>
      request(
        "GET",
        `/databases/${databaseId}/collections/${collectionId}/attributes/${body.key}`,
      ),
  );
}

for (const [collectionId, attributes] of Object.entries(schemas))
  for (const definition of attributes)
    await createAttribute(collectionId, definition);

async function waitForAttributes() {
  for (let attempt = 0; attempt < 60; attempt++) {
    let pending = 0;
    for (const collectionId of Object.keys(schemas)) {
      const result = await request(
        "GET",
        `/databases/${databaseId}/collections/${collectionId}/attributes`,
      );
      pending += result.attributes.filter(
        (item) => item.status !== "available",
      ).length;
    }
    if (!pending) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    "Los atributos no terminaron de crearse dentro del tiempo esperado",
  );
}

await waitForAttributes();

const indexes = {
  unidades_administrativas: [
    { key: "clave_unique", type: "unique", attributes: ["clave"] },
    { key: "activo_idx", type: "key", attributes: ["activo"] },
  ],
  usuarios_perfil: [
    { key: "user_unique", type: "unique", attributes: ["userId"] },
    { key: "email_unique", type: "unique", attributes: ["email"] },
    {
      key: "rol_unidad_idx",
      type: "key",
      attributes: ["rol", "unidadAdministrativaId"],
    },
  ],
  tramites_servicios: [
    { key: "clave_unique", type: "unique", attributes: ["clave"] },
    {
      key: "unidad_activo_idx",
      type: "key",
      attributes: ["unidadAdministrativaId", "activo"],
    },
  ],
  requisitos: [
    {
      key: "tramite_orden_idx",
      type: "key",
      attributes: ["tramiteServicioId", "orden"],
    },
  ],
  solicitudes: [
    { key: "folio_unique", type: "unique", attributes: ["folio"] },
    {
      key: "unidad_estatus_fecha_idx",
      type: "key",
      attributes: ["unidadAdministrativaId", "estatus", "fechaSolicitud"],
      orders: ["ASC", "ASC", "DESC"],
    },
    {
      key: "solicitante_fecha_idx",
      type: "key",
      attributes: ["solicitanteUserId", "fechaSolicitud"],
      orders: ["ASC", "DESC"],
    },
    {
      key: "tramite_fecha_idx",
      type: "key",
      attributes: ["tramiteServicioId", "fechaSolicitud"],
      orders: ["ASC", "DESC"],
    },
  ],
  solicitudes_secretaria: [
    { key: "ruta_estatus_fecha_idx", type: "key", attributes: ["rutaAtencion", "estatus", "fechaRegistro"], orders: ["ASC", "ASC", "DESC"] },
    { key: "unidad_fecha_idx", type: "key", attributes: ["unidadResponsableId", "fechaRegistro"], orders: ["ASC", "DESC"] },
  ],
  documentos_solicitud: [
    { key: "solicitud_idx", type: "key", attributes: ["solicitudId"] },
  ],
  historial_solicitud: [
    {
      key: "solicitud_fecha_idx",
      type: "key",
      attributes: ["solicitudId", "fecha"],
      orders: ["ASC", "DESC"],
    },
  ],
  folio_contadores: [
    { key: "periodo_unique", type: "unique", attributes: ["periodo"] },
  ],
  configuracion_formulario_global: [
    {
      key: "activo_version_idx",
      type: "key",
      attributes: ["activo", "version"],
      orders: ["ASC", "DESC"],
    },
  ],
  eventos_atencion: [
    {
      key: "fecha_municipio_idx",
      type: "key",
      attributes: ["fechaInicio", "municipio"],
      orders: ["DESC", "ASC"],
    },
    {
      key: "activo_fecha_idx",
      type: "key",
      attributes: ["activo", "fechaInicio"],
      orders: ["ASC", "DESC"],
    },
  ],
};

for (const [collectionId, definitions] of Object.entries(indexes)) {
  for (const definition of definitions)
    await ensure(
      `index ${collectionId}.${definition.key}`,
      () =>
        request(
          "POST",
          `/databases/${databaseId}/collections/${collectionId}/indexes`,
          definition,
        ),
      () =>
        request(
          "GET",
          `/databases/${databaseId}/collections/${collectionId}/indexes/${definition.key}`,
        ),
    );
}

const seed = JSON.parse(
  await fs.readFile(path.join(root, "scripts/appwrite/seed.json"), "utf8"),
);
for (const unit of seed.units) {
  const team = await ensure(
    `team unidad-${unit.id}`,
    () =>
      request("POST", "/teams", {
        teamId: `unidad-${unit.id}`,
        name: unit.name,
      }),
    () => request("GET", `/teams/unidad-${unit.id}`),
  );
  const data = {
    clave: unit.code,
    nombre: unit.name,
    descripcion: unit.description,
    teamId: team.$id,
    activo: true,
  };
  await ensure(
    `unit ${unit.id}`,
    () =>
      request(
        "POST",
        `/databases/${databaseId}/collections/unidades_administrativas/documents`,
        { documentId: unit.id, data },
      ),
    () =>
      request(
        "GET",
        `/databases/${databaseId}/collections/unidades_administrativas/documents/${unit.id}`,
      ),
  );
}

for (const [serviceOrder, service] of seed.services.entries()) {
  const data = {
    unidadAdministrativaId: service.unitId,
    tipo: service.type,
    clave: service.code,
    nombre: service.name,
    descripcion: service.description,
    poblacionObjetivo: service.targetAudience,
    costo: service.cost,
    activo: true,
    orden: serviceOrder + 1,
    configuracionFormulario: JSON.stringify({ fields: [] }),
  };
  await ensure(
    `service ${service.id}`,
    () =>
      request(
        "POST",
        `/databases/${databaseId}/collections/tramites_servicios/documents`,
        { documentId: service.id, data },
      ),
    () =>
      request(
        "GET",
        `/databases/${databaseId}/collections/tramites_servicios/documents/${service.id}`,
      ),
  );
  for (const [
    requirementOrder,
    requirement,
  ] of service.requirements.entries()) {
    const requirementId = `${service.id}-req-${requirementOrder + 1}`;
    const requirementData = {
      tramiteServicioId: service.id,
      nombre: requirement,
      obligatorio: true,
      orden: requirementOrder + 1,
      activo: true,
    };
    await ensure(
      `requirement ${requirementId}`,
      () =>
        request(
          "POST",
          `/databases/${databaseId}/collections/requisitos/documents`,
          { documentId: requirementId, data: requirementData },
        ),
      () =>
        request(
          "GET",
          `/databases/${databaseId}/collections/requisitos/documents/${requirementId}`,
        ),
    );
  }
}

await ensure(
  "global form default",
  () =>
    request(
      "POST",
      `/databases/${databaseId}/collections/configuracion_formulario_global/documents`,
      {
        documentId: "global-v1",
        data: {
          nombre: "Formulario general de solicitudes",
          version: 1,
          activo: true,
          campos: JSON.stringify({
            fields: [
              { key: "nombre", label: "Nombre", type: "text", required: true },
              {
                key: "primerApellido",
                label: "Primer apellido",
                type: "text",
                required: true,
              },
              {
                key: "segundoApellido",
                label: "Segundo apellido",
                type: "text",
                required: false,
              },
              { key: "curp", label: "CURP", type: "text", required: true },
              {
                key: "telefono",
                label: "Teléfono",
                type: "tel",
                required: true,
              },
              {
                key: "correo",
                label: "Correo electrónico",
                type: "email",
                required: false,
              },
              {
                key: "direccion",
                label: "Dirección",
                type: "text",
                required: true,
              },
              {
                key: "municipio",
                label: "Municipio",
                type: "select",
                required: true,
              },
            ],
          }),
        },
      },
    ),
  () =>
    request(
      "GET",
      `/databases/${databaseId}/collections/configuracion_formulario_global/documents/global-v1`,
    ),
);

console.log("\nProvisionamiento terminado correctamente.");
console.log(`DATABASE_ID=${databaseId}`);
console.log(
  `Unidades=${seed.units.length} Trámites/servicios=${seed.services.length}`,
);
