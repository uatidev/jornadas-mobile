import { ExecutionMethod } from "react-native-appwrite";
import { getAppwriteFunctions } from "./appwrite";
import type { SecretaryRequest, SecretaryRequestDocument, SecretaryRequestStatus, ServiceRequest } from "@/src/types/request";

const FUNCTION_ID = "identity-api";

async function execute<T>(payload: Record<string, unknown>): Promise<T> {
  const execution = await getAppwriteFunctions().createExecution(
    FUNCTION_ID,
    JSON.stringify(payload),
    false,
    undefined,
    ExecutionMethod.POST,
  );
  const response = execution.responseBody
    ? JSON.parse(execution.responseBody)
    : {};
  if (execution.status === "failed" || execution.responseStatusCode >= 400) {
    throw new Error(response.message || "La operación no pudo completarse");
  }
  return response as T;
}

export interface SubmittedRequest {
  id: string;
  folio: string;
  eventFolio?: string;
  programFolio?: string;
  status: string;
  priorityOnReopening?: boolean;
  waitingForOpening?: boolean;
  emailSent?: boolean;
  emailMessage?: string;
  receipt?: RequestReceipt;
}

export interface RequestReceipt {
  serviceName: string;
  serviceType: string;
  status: string;
  requestedAt: string;
  attendedBy: string;
  unitName: string;
  unitContactName?: string;
  unitContactEmail?: string;
  unitContactPhone?: string;
  unitContactExtension?: string;
  serviceContactName?: string;
  serviceContactEmail?: string;
  serviceContactPhone?: string;
  serviceContactExtension?: string;
  eventName: string;
  eventVenue?: string;
  eventAddress?: string;
  eventLocality?: string;
  eventMunicipality?: string;
}

export interface ReportingStaffMember {
  id: string;
  name: string;
  role: string;
  unitId?: string;
}

export interface CanalizationReportItem {
  id: string;
  folio: string;
  serviceId: string;
  previousUnitId?: string;
  destinationUnitId?: string;
  reason?: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  pending: boolean;
}

export interface EmailDeliveryItem {
  id: string;
  folio: string;
  requestType: "normal" | "secretaria";
  currentEmail?: string;
  lastSentEmail?: string;
  sent: boolean;
  lastAttemptAt?: string;
  error?: string;
  emailChanged: boolean;
}

export const identityApi = {
  ensureProfile: () => execute({ action: "ensureProfile" }),
  getServicePopularity: () =>
    execute<{ counts: Record<string, number> }>({ action: "servicePopularity" }),
  submitRequest: (
    serviceId: string,
    applicantData: unknown,
    requestData: unknown,
    eventId?: string,
    recipientEmail?: string,
    priority?: boolean,
  ) =>
    execute<SubmittedRequest>({
      action: "submitRequest",
      serviceId,
      applicantData,
      requestData,
      eventId,
      recipientEmail,
      priority,
    }),
  createStaffUser: (data: {
    email: string;
    password: string;
    name: string;
    unitId?: string;
    role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista";
  }) => execute({ action: "createStaffUser", ...data }),
  updateStaffUser: (data: {
    id: string;
    email: string;
    name: string;
    unitId?: string;
    role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista";
    active: boolean;
    password?: string;
  }) => execute({ action: "updateStaffUser", ...data }),
  updateStatus: (requestId: string, status: string, comment?: string, outcome?: {
    finalResult?: string;
    discontinuationReason?: string;
    receivedBenefit?: boolean;
    benefitDetail?: string;
  }) => execute({ action: "updateStatus", requestId, status, comment, ...outcome }),
  resendRequestReceipt: (requestId: string, recipientEmail: string) =>
    execute<{ sent: boolean; message: string }>({
      action: "resendRequestReceipt",
      requestId,
      recipientEmail,
    }),
  resendSecretaryReceipt: (requestId: string, recipientEmail: string) =>
    execute<{ sent: boolean; message: string }>({ action: "resendSecretaryReceipt", requestId, recipientEmail }),
  adminUpdateRequestData: (requestId: string, applicantData: Record<string, unknown>, requestData: Record<string, unknown>, reason: string) =>
    execute({ action: "adminUpdateRequestData", requestId, applicantData, requestData, reason }),
  adminUpdateSecretaryRequestData: (requestId: string, data: {
    applicantData: Record<string, string>;
    documents?: SecretaryRequestDocument[];
    subject: string;
    source: "gobernador" | "oficina_gubernamental" | "otra";
    officeNumber?: string;
    officeDate?: string;
    notes?: string;
    reason: string;
  }) => execute({ action: "adminUpdateSecretaryRequestData", requestId, ...data }),
  finishEvent: (eventId: string) => execute({ action: "finishEvent", eventId }),
  getReportingStaff: () =>
    execute<{ staff: ReportingStaffMember[] }>({ action: "reportingStaff" }),
  requestReassignment: (requestId: string, reason: string) =>
    execute({ action: "requestReassignment", requestId, reason }),
  listReassignmentQueue: () =>
    execute<{ requests: ServiceRequest[] }>({ action: "listReassignmentQueue" }),
  getCanalizationReport: () =>
    execute<{ items: CanalizationReportItem[] }>({ action: "canalizationReport" }),
  getEmailDeliveryReport: () =>
    execute<{ items: EmailDeliveryItem[] }>({ action: "emailDeliveryReport" }),
  reassignRequest: (requestId: string, unitId: string, comment?: string) =>
    execute({ action: "reassignRequest", requestId, unitId, comment }),
  submitSecretaryRequest: (data: {
    applicantData: Record<string, string>;
    subject: string;
    source: "gobernador" | "oficina_gubernamental" | "otra";
    officeNumber?: string;
    officeDate?: string;
    notes?: string;
    route: "secretaria" | "canalizacion";
    eventId: string;
    recipientEmail?: string;
    documents: SecretaryRequestDocument[];
  }) => execute<{ request: SecretaryRequest; emailSent: boolean; emailMessage: string }>({ action: "submitSecretaryRequest", ...data }),
  listSecretaryRequests: () =>
    execute<{ requests: SecretaryRequest[] }>({ action: "listSecretaryRequests" }),
  listMySecretaryRequests: () =>
    execute<{ requests: SecretaryRequest[] }>({ action: "listMySecretaryRequests" }),
  updateSecretaryRequest: (requestId: string, data: {
    status?: SecretaryRequestStatus;
    unitId?: string;
    comment?: string;
  }) => execute<{ request: SecretaryRequest }>({ action: "updateSecretaryRequest", requestId, ...data }),
  saveAdministrativeUnit: (data: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactExtension?: string;
    active: boolean;
  }) => execute({ action: "saveAdministrativeUnit", ...data }),
};
