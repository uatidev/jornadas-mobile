import { ExecutionMethod } from "react-native-appwrite";
import { getAppwriteFunctions } from "./appwrite";
import type { ServiceRequest } from "@/src/types/request";

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
  emailSent?: boolean;
  emailMessage?: string;
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

export const identityApi = {
  ensureProfile: () => execute({ action: "ensureProfile" }),
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
  finishEvent: (eventId: string) => execute({ action: "finishEvent", eventId }),
  getReportingStaff: () =>
    execute<{ staff: ReportingStaffMember[] }>({ action: "reportingStaff" }),
  requestReassignment: (requestId: string, reason: string) =>
    execute({ action: "requestReassignment", requestId, reason }),
  listReassignmentQueue: () =>
    execute<{ requests: ServiceRequest[] }>({ action: "listReassignmentQueue" }),
  getCanalizationReport: () =>
    execute<{ items: CanalizationReportItem[] }>({ action: "canalizationReport" }),
  reassignRequest: (requestId: string, unitId: string, comment?: string) =>
    execute({ action: "reassignRequest", requestId, unitId, comment }),
  saveAdministrativeUnit: (data: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    contactEmail?: string;
    active: boolean;
  }) => execute({ action: "saveAdministrativeUnit", ...data }),
};
