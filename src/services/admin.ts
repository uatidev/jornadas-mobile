import { ID, Query } from "react-native-appwrite";
import { APPWRITE_CONFIG, getAppwriteDatabases } from "./appwrite";
import { identityApi } from "./identityApi";
import type {
  AdministrativeUnit,
  AttentionEvent,
  GlobalFormConfiguration,
  ProcedureService,
  Requirement,
  ServiceFormField,
  ServiceType,
} from "@/src/types/catalog";
import { municipalityFolioCode } from "@/src/constants/tabasco";

const databases = () => getAppwriteDatabases();
const databaseId = APPWRITE_CONFIG.DATABASE_ID;

const mapUnit = (doc: any): AdministrativeUnit => ({
  id: doc.$id,
  code: doc.clave,
  name: doc.nombre,
  description: doc.descripcion,
  contactName: doc.titular,
  contactEmail: doc.correoContacto,
  contactPhone: doc.telefonoContacto,
  contactExtension: doc.extensionTelefono,
  teamId: doc.teamId,
  active: doc.activo,
});

const mapService = (doc: any): ProcedureService => ({
  id: doc.$id,
  unitId: doc.unidadAdministrativaId,
  code: doc.clave,
  type: doc.tipo,
  name: doc.nombre,
  description: doc.descripcion,
  targetAudience: doc.poblacionObjetivo,
  cost: doc.costo,
  active: doc.activo,
  order: doc.orden ?? 0,
  formConfig: (() => {
    try {
      return JSON.parse(doc.configuracionFormulario || "{}");
    } catch {
      return {};
    }
  })(),
  usesGlobalForm: doc.usaFormularioGlobal ?? true,
  programFolioPrefix: doc.prefijoFolioPrograma,
  imageFileId: doc.imagenFileId,
  imageUrl: doc.imagenUrl,
  opensAt: doc.vigenciaInicio,
  closesAt: doc.vigenciaFin,
  contactName: doc.titularResponsable,
  contactEmail: doc.correoContacto,
  contactPhone: doc.telefonoContacto,
  contactExtension: doc.extensionTelefono,
});

const mapRequirement = (doc: any): Requirement => ({
  id: doc.$id,
  serviceId: doc.tramiteServicioId,
  name: doc.nombre,
  description: doc.descripcion,
  documentType: doc.tipoDocumento,
  required: doc.obligatorio,
  order: doc.orden ?? 0,
});

export interface ServiceInput {
  id?: string;
  unitId: string;
  code: string;
  type: ServiceType;
  name: string;
  description: string;
  targetAudience?: string;
  cost?: string;
  active: boolean;
  formConfig?: object;
  requirements: (string | ServiceRequirementInput)[];
  usesGlobalForm?: boolean;
  programFolioPrefix?: string;
  imageFileId?: string;
  imageUrl?: string;
  opensAt?: string;
  closesAt?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactExtension?: string;
}

export interface ServiceRequirementInput {
  name: string;
  description?: string;
  documentType?: string;
  required: boolean;
}

export type AttentionEventInput = Omit<AttentionEvent, "id"> & { id?: string };

export interface AdminUserProfile {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista" | "solicitante";
  unitId?: string;
  active: boolean;
}

export const adminService = {
  async listUnits(): Promise<AdministrativeUnit[]> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.UNIDADES_ADMINISTRATIVAS,
      [Query.orderAsc("nombre"), Query.limit(100)],
    );
    return result.documents.map(mapUnit);
  },

  async listServices(): Promise<ProcedureService[]> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.TRAMITES_SERVICIOS,
      [Query.orderAsc("orden"), Query.limit(100)],
    );
    return result.documents.map(mapService);
  },

  async listProfiles(): Promise<AdminUserProfile[]> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.USUARIOS_PERFIL,
      [Query.orderAsc("nombre"), Query.limit(100)],
    );
    return result.documents.map((doc: any) => ({
      id: doc.$id,
      email: doc.email,
      name: doc.nombre,
      role: doc.rolSistema || doc.rol,
      unitId: doc.unidadAdministrativaId || undefined,
      active: doc.activo,
    }));
  },

  async getGlobalForm(): Promise<GlobalFormConfiguration> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.CONFIGURACION_FORMULARIO_GLOBAL,
      [Query.equal("activo", true), Query.orderDesc("version"), Query.limit(1)],
    );
    const doc: any = result.documents[0];
    if (!doc)
      return {
        id: "",
        name: "Formulario global",
        version: 0,
        active: true,
        fields: [],
        enableINEAnalysis: false,
      };
    let config: {
      fields?: ServiceFormField[];
      enableINEAnalysis?: boolean;
      secretaryContact?: GlobalFormConfiguration["secretaryContact"];
    } = {};
    try {
      config = JSON.parse(doc.campos);
    } catch {
      config = {};
    }
    return {
      id: doc.$id,
      name: doc.nombre,
      version: doc.version,
      active: doc.activo,
      fields: config.fields || [],
      enableINEAnalysis: Boolean(config.enableINEAnalysis),
      secretaryContact: config.secretaryContact || {},
    };
  },

  async saveGlobalForm(input: GlobalFormConfiguration) {
    const data = {
      nombre: input.name,
      version: input.version,
      activo: input.active,
      campos: JSON.stringify({
        fields: input.fields,
        enableINEAnalysis: Boolean(input.enableINEAnalysis),
        secretaryContact: input.secretaryContact || {},
      }),
    };
    return input.id
      ? databases().updateDocument(
          databaseId,
          APPWRITE_CONFIG.COLLECTIONS.CONFIGURACION_FORMULARIO_GLOBAL,
          input.id,
          data,
        )
      : databases().createDocument(
          databaseId,
          APPWRITE_CONFIG.COLLECTIONS.CONFIGURACION_FORMULARIO_GLOBAL,
          ID.unique(),
          data,
        );
  },

  async listEvents(): Promise<AttentionEvent[]> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.EVENTOS_ATENCION,
      [Query.orderDesc("fechaInicio"), Query.limit(100)],
    );
    return result.documents.map((doc: any) => ({
      id: doc.$id,
      name: doc.nombre,
      municipality: doc.municipio,
      municipalityCode: doc.claveMunicipio,
      venue: doc.sede,
      address: doc.direccion,
      locality: doc.localidad,
      startsAt: doc.fechaInicio,
      endsAt: doc.fechaFin,
      // Appwrite can return numeric attributes as serialized values depending on
      // how older records were imported. Keep the domain model consistent so
      // map consumers can reliably validate and position every event.
      latitude: Number(doc.latitud),
      longitude: Number(doc.longitud),
      active: doc.activo,
      folioPrefix: doc.prefijoFolio,
      capacity: doc.capacidad,
      notes: doc.notas,
    }));
  },

  async saveEvent(input: AttentionEventInput): Promise<string> {
    const id = input.id || ID.unique();
    const code = municipalityFolioCode(input.municipality);
    let eventFolio = input.folioPrefix;
    if (
      !input.id ||
      input.municipalityCode !== code ||
      !/-\d+$/.test(input.folioPrefix)
    ) {
      const existing = await databases().listDocuments(
        databaseId,
        APPWRITE_CONFIG.COLLECTIONS.EVENTOS_ATENCION,
        [Query.equal("municipio", input.municipality), Query.limit(100)],
      );
      const lastNumber = existing.documents.reduce((maximum, document: any) => {
        const match = String(document.prefijoFolio || "").match(/-(\d+)$/);
        return Math.max(maximum, match ? Number(match[1]) : 0);
      }, 0);
      eventFolio = `${code}-${String(lastNumber + 1).padStart(2, "0")}`;
    }
    const data = {
      nombre: input.name.trim(),
      municipio: input.municipality,
      localidad: input.locality.trim(),
      claveMunicipio: code,
      sede: input.name.trim(),
      direccion: input.address.trim(),
      fechaInicio: input.startsAt,
      fechaFin: input.endsAt,
      latitud: input.latitude,
      longitud: input.longitude,
      activo: input.active,
      prefijoFolio: eventFolio,
      capacidad: null,
      notas: input.notes?.trim() || null,
    };
    if (input.id)
      await databases().updateDocument(
        databaseId,
        APPWRITE_CONFIG.COLLECTIONS.EVENTOS_ATENCION,
        id,
        data,
      );
    else
      await databases().createDocument(
        databaseId,
        APPWRITE_CONFIG.COLLECTIONS.EVENTOS_ATENCION,
        id,
        data,
      );
    return id;
  },

  async listRequirements(serviceId: string): Promise<Requirement[]> {
    const result = await databases().listDocuments(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.REQUISITOS,
      [
        Query.equal("tramiteServicioId", serviceId),
        Query.orderAsc("orden"),
        Query.limit(100),
      ],
    );
    return result.documents.map(mapRequirement);
  },

  async saveService(input: ServiceInput): Promise<string> {
    if (Boolean(input.opensAt) !== Boolean(input.closesAt))
      throw new Error(
        "Captura tanto la fecha de apertura como la fecha de cierre, o deja ambas vacías",
      );
    if (
      input.opensAt &&
      input.closesAt &&
      new Date(input.opensAt) > new Date(input.closesAt)
    )
      throw new Error("La fecha de cierre debe ser posterior a la apertura");
    const collection = APPWRITE_CONFIG.COLLECTIONS.TRAMITES_SERVICIOS;
    const id = input.id || ID.unique();
    const data = {
      unidadAdministrativaId: input.unitId,
      clave: input.code.trim().toUpperCase(),
      tipo: input.type,
      nombre: input.name.trim(),
      descripcion: input.description.trim(),
      poblacionObjetivo: input.targetAudience?.trim() || null,
      costo: input.cost?.trim() || "Gratuito",
      activo: input.active,
      configuracionFormulario: JSON.stringify(
        input.formConfig || { fields: [] },
      ),
      usaFolioPrograma: true,
      usaFormularioGlobal: input.usesGlobalForm ?? true,
      prefijoFolioPrograma:
        input.programFolioPrefix?.trim().toUpperCase() ||
        input.code.trim().toUpperCase(),
      imagenFileId: input.imageFileId || null,
      imagenUrl: input.imageUrl || null,
      vigenciaInicio: input.opensAt || null,
      vigenciaFin: input.closesAt || null,
      titularResponsable: input.contactName?.trim() || null,
      correoContacto: input.contactEmail?.trim().toLowerCase() || null,
      telefonoContacto: input.contactPhone?.trim() || null,
      extensionTelefono: input.contactExtension?.trim() || null,
    };
    if (input.id)
      await databases().updateDocument(databaseId, collection, id, data);
    else
      await databases().createDocument(databaseId, collection, id, {
        ...data,
        orden: Date.now() % 10000,
      });

    const current = await this.listRequirements(id);
    await Promise.all(
      current.map((item) =>
        databases().deleteDocument(
          databaseId,
          APPWRITE_CONFIG.COLLECTIONS.REQUISITOS,
          item.id,
        ),
      ),
    );
    for (const [index, rawRequirement] of input.requirements.entries()) {
      const requirement =
        typeof rawRequirement === "string"
          ? { name: rawRequirement, required: true }
          : rawRequirement;
      await databases().createDocument(
        databaseId,
        APPWRITE_CONFIG.COLLECTIONS.REQUISITOS,
        ID.unique(),
        {
          tramiteServicioId: id,
          nombre: requirement.name.trim(),
          descripcion: requirement.description?.trim() || null,
          tipoDocumento: requirement.documentType?.trim() || null,
          obligatorio: requirement.required,
          orden: index + 1,
          activo: true,
        },
      );
    }
    return id;
  },

  async setServiceActive(id: string, active: boolean) {
    return databases().updateDocument(
      databaseId,
      APPWRITE_CONFIG.COLLECTIONS.TRAMITES_SERVICIOS,
      id,
      { activo: active },
    );
  },

  createStaffUser(input: {
    email: string;
    password: string;
    name: string;
    unitId?: string;
    role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista";
  }) {
    return identityApi.createStaffUser(input);
  },
};
