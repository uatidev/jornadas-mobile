import { Query } from "react-native-appwrite";
import { ServiceRequest } from "@/src/types/request";
import { APPWRITE_CONFIG, getAppwriteDatabases } from "./appwrite";

const parseData = (value?: string) => {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
};

const mapDoc = (doc: any): ServiceRequest => {
  const applicantData = parseData(doc.datosSolicitante);
  const requestData = parseData(doc.datosTramite);
  const tracking = requestData.__seguimiento || {};
  const visibleRequestData = { ...requestData };
  delete visibleRequestData.__seguimiento;
  return ({
  id: doc.$id,
  folio: doc.folio,
  serviceId: doc.tramiteServicioId,
  unitId: doc.unidadAdministrativaId,
  applicantUserId: doc.solicitanteUserId,
  status: doc.estatus,
  requestedAt: doc.fechaSolicitud,
  assignedUserId: doc.asignadoAUserId,
  notes: doc.observaciones,
  eventId: doc.eventoAtencionId,
  eventFolio: doc.folioEvento,
  programFolio: doc.folioPrograma,
  priorityOnReopening: doc.prioridadReapertura ?? false,
  finalResult: doc.resultadoFinal ?? tracking.resultadoFinal,
  discontinuationReason: doc.motivoNoContinuidad ?? tracking.motivoNoContinuidad,
  receivedBenefit: doc.apoyoRecibido ?? tracking.apoyoRecibido,
  benefitDetail: doc.detalleBeneficio ?? tracking.detalleBeneficio,
  reassignmentRequired: doc.requiereReasignacion ?? tracking.requiereReasignacion ?? false,
  reassignmentReason: doc.motivoReasignacion ?? tracking.motivoReasignacion,
  previousUnitId: doc.unidadAnteriorId ?? tracking.unidadAnteriorId,
  applicantData,
  requestData: visibleRequestData,
  });
};

export const requestsService = {
  /** Solicitudes creadas por el usuario, independientemente de la unidad responsable. */
  async listByCapturista(userId: string): Promise<ServiceRequest[]> {
    if (!userId) return [];
    const result = await getAppwriteDatabases().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
      [
        Query.equal("solicitanteUserId", userId),
        Query.orderDesc("fechaSolicitud"),
        Query.limit(500),
      ],
    );
    return result.documents.map(mapDoc);
  },

  async getById(requestId: string): Promise<ServiceRequest> {
    const document = await getAppwriteDatabases().getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
      requestId,
    );
    return mapDoc(document);
  },

  /** Bandeja operativa limitada explícitamente a una unidad administrativa. */
  async listByUnit(unitId: string): Promise<ServiceRequest[]> {
    if (!unitId) throw new Error("El gestor no tiene una unidad administrativa asignada");
    const result = await getAppwriteDatabases().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
      [
        Query.equal("unidadAdministrativaId", unitId),
        Query.orderDesc("fechaSolicitud"),
        Query.limit(100),
      ],
    );
    return result.documents
      .map(mapDoc)
      .sort((a, b) => Number(Boolean(b.priorityOnReopening)) - Number(Boolean(a.priorityOnReopening)));
  },

  /** Lista todas las solicitudes accesibles (hasta 100, orden descendente por fecha) */
  async listAccessible(): Promise<ServiceRequest[]> {
    const result = await getAppwriteDatabases().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
      [Query.orderDesc("fechaSolicitud"), Query.limit(100)]
    );
    return result.documents.map(mapDoc);
  },

  /** Obtiene todos los documentos accesibles para reportes, recorriendo la paginacion. */
  async listAllAccessible(): Promise<ServiceRequest[]> {
    const documents: any[] = [];
    const pageSize = 100;
    let offset = 0;
    while (true) {
      const result = await getAppwriteDatabases().listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
        [
          Query.orderDesc("fechaSolicitud"),
          Query.limit(pageSize),
          Query.offset(offset),
        ],
      );
      documents.push(...result.documents);
      if (result.documents.length < pageSize) break;
      offset += pageSize;
    }
    return documents.map(mapDoc);
  },

  /** Lista solicitudes filtradas por un evento de atención específico */
  async listByEvent(eventId: string): Promise<ServiceRequest[]> {
    const result = await getAppwriteDatabases().listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.SOLICITUDES,
      [
        Query.equal("eventoAtencionId", eventId),
        Query.orderDesc("fechaSolicitud"),
        Query.limit(200),
      ]
    );
    return result.documents.map(mapDoc);
  },
};
