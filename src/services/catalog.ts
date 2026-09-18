import { Query } from "react-native-appwrite";
import {
  AdministrativeUnit,
  AttentionEvent,
  GlobalFormConfiguration,
  ProcedureService,
  Requirement,
} from "@/src/types/catalog";
import { APPWRITE_CONFIG, getAppwriteDatabases } from "./appwrite";

const db = () => getAppwriteDatabases();

const parseConfig = (value?: string) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const catalogService = {
  async listUnits(): Promise<AdministrativeUnit[]> {
    const result = await db().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.UNIDADES_ADMINISTRATIVAS,
      [Query.equal("activo", true), Query.orderAsc("nombre"), Query.limit(100)],
    );
    return result.documents.map((doc: any) => ({
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
    }));
  },

  async listServices(): Promise<ProcedureService[]> {
    const result = await db().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.TRAMITES_SERVICIOS,
      [Query.orderAsc("orden"), Query.limit(100)],
    );
    return result.documents.map((doc: any) => ({
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
      formConfig: parseConfig(doc.configuracionFormulario),
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
    }));
  },

  async getService(serviceId: string): Promise<ProcedureService> {
    const doc: any = await db().getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.TRAMITES_SERVICIOS,
      serviceId,
    );
    return {
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
      formConfig: parseConfig(doc.configuracionFormulario),
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
    };
  },

  async listRequirements(serviceId: string): Promise<Requirement[]> {
    const result = await db().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.REQUISITOS,
      [
        Query.equal("tramiteServicioId", serviceId),
        Query.equal("activo", true),
        Query.orderAsc("orden"),
        Query.limit(100),
      ],
    );
    return result.documents.map((doc: any) => ({
      id: doc.$id,
      serviceId: doc.tramiteServicioId,
      name: doc.nombre,
      description: doc.descripcion,
      documentType: doc.tipoDocumento,
      required: doc.obligatorio,
      order: doc.orden ?? 0,
    }));
  },

  async getGlobalForm(): Promise<GlobalFormConfiguration> {
    const result = await db().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.CONFIGURACION_FORMULARIO_GLOBAL,
      [Query.equal("activo", true), Query.orderDesc("version"), Query.limit(1)],
    );
    const doc: any = result.documents[0];
    if (!doc) throw new Error("No existe un formulario global activo");
    let parsed: any = {};
    try {
      parsed = JSON.parse(doc.campos);
    } catch {
      parsed = {};
    }
    return {
      id: doc.$id,
      name: doc.nombre,
      version: doc.version,
      active: doc.activo,
      fields: parsed.fields || [],
      enableINEAnalysis: Boolean(parsed.enableINEAnalysis),
      secretaryContact: parsed.secretaryContact || {},
    };
  },

  async listActiveEvents(): Promise<AttentionEvent[]> {
    const result = await db().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.EVENTOS_ATENCION,
      [
        Query.equal("activo", true),
        Query.orderDesc("fechaInicio"),
        Query.limit(100),
      ],
    );
    const now = Date.now();
    return result.documents.map((doc: any) => ({
      id: doc.$id,
      name: doc.nombre,
      municipality: doc.municipio,
      locality: doc.localidad,
      municipalityCode: doc.claveMunicipio,
      venue: doc.sede,
      address: doc.direccion,
      startsAt: doc.fechaInicio,
      endsAt: doc.fechaFin,
      latitude: Number(doc.latitud),
      longitude: Number(doc.longitud),
      active: doc.activo,
      folioPrefix: doc.prefijoFolio,
      capacity: doc.capacidad,
      notes: doc.notas,
    })).filter((event) => {
      const startsAt = new Date(event.startsAt).getTime();
      const endsAt = new Date(event.endsAt).getTime();
      return event.active && now >= startsAt && now <= endsAt;
    });
  },
};
