export type ServiceType = "tramite" | "servicio" | "programa";

export interface AdministrativeUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactExtension?: string;
  teamId: string;
  active: boolean;
}

export interface ProcedureService {
  id: string;
  unitId: string;
  code: string;
  type: ServiceType;
  name: string;
  description: string;
  targetAudience?: string;
  cost?: string;
  active: boolean;
  order: number;
  formConfig?: { fields?: ServiceFormField[] };
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

export interface ServiceFormField {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "date"
    | "select"
    | "multiselect"
    | "boolean"
    | "file"
    | "textarea";
  fileType?: "document" | "image" | "any";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface GlobalFormConfiguration {
  id: string;
  name: string;
  version: number;
  active: boolean;
  fields: ServiceFormField[];
  enableINEAnalysis?: boolean;
}

export interface AttentionEvent {
  id: string;
  name: string;
  municipality: string;
  locality: string;
  municipalityCode: string;
  venue: string;
  address: string;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  active: boolean;
  folioPrefix: string;
  capacity?: number;
  notes?: string;
}

export interface Requirement {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  documentType?: string;
  required: boolean;
  order: number;
}
