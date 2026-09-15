export type RequestStatus = "borrador" | "enviada" | "recibida" | "en_revision" | "requiere_informacion" | "aprobada" | "rechazada" | "cancelada" | "concluida";

export interface ServiceRequest {
  id: string;
  folio: string;
  serviceId: string;
  unitId: string;
  applicantUserId: string;
  status: RequestStatus;
  requestedAt: string;
  assignedUserId?: string;
  notes?: string;
  eventId?: string;
  eventFolio?: string;
  programFolio?: string;
  priorityOnReopening?: boolean;
  finalResult?: string;
  discontinuationReason?: string;
  receivedBenefit?: boolean;
  benefitDetail?: string;
  reassignmentRequired?: boolean;
  reassignmentReason?: string;
  previousUnitId?: string;
  applicantData?: Record<string, unknown>;
  requestData?: Record<string, unknown>;
}

export interface RequestHistoryEntry {
  id: string;
  requestId: string;
  previousStatus?: string;
  newStatus: string;
  comment?: string;
  performedByUserId: string;
  date: string;
}
