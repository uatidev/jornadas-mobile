export type RequestStatus = "borrador" | "enviada" | "en_espera_apertura" | "recibida" | "en_revision" | "requiere_informacion" | "aprobada" | "rechazada" | "cancelada" | "concluida";

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
  waitingForOpening?: boolean;
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

export type SecretaryRequestRoute = "secretaria" | "canalizacion" | "canalizada";
export type SecretaryRequestStatus = "recibida" | "en_atencion" | "requiere_informacion" | "pendiente_canalizacion" | "canalizada" | "atendida" | "cancelada";

export interface SecretaryRequestDocument {
  fileId: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
}

export interface SecretaryRequest {
  id: string;
  folio: string;
  applicantData: Record<string, string>;
  subject: string;
  source: "gobernador" | "oficina_gubernamental" | "otra";
  officeNumber?: string;
  officeDate?: string;
  notes?: string;
  route: SecretaryRequestRoute;
  status: SecretaryRequestStatus;
  capturedByUserId: string;
  capturedByName: string;
  capturedOnBehalfOfSecretary: boolean;
  highPriority: boolean;
  responsibleUnitId?: string;
  eventId?: string;
  eventFolio?: string;
  documents: SecretaryRequestDocument[];
  createdAt: string;
  updatedAt: string;
}
