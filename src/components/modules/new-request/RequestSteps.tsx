import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import Monicon from "@monicon/native";
import React from "react";
import { View } from "react-native";
import {
  useCatalogService,
  useServiceRequirements,
} from "@/src/hooks/useCatalog";
import { DynamicGlobalForm } from "./DynamicGlobalForm";

export type SpecificRequestData = Record<string, string>;

const DETAILS: Record<
  string,
  { appliesTo: string; requirements: string[]; opening?: string }
> = {
  "sadsasdd-dadsads-ewerdf-111": {
    appliesTo:
      "Mujeres mayores de edad que tengan o quieran iniciar un negocio.",
    requirements: [
      "INE vigente",
      "CURP",
      "Comprobante de domicilio",
      "Descripción del emprendimiento",
    ],
    opening: "15 de septiembre de 2026",
  },
  "sadsasdd-dadsads-ewerdf-222": {
    appliesTo:
      "Personas emprendedoras y prestadores de servicios que desean formalizar su actividad.",
    requirements: [
      "INE vigente",
      "CURP",
      "Comprobante de domicilio",
      "Información básica del negocio",
    ],
  },
};

const SPECIFIC_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string }[]
> = {
  "sadsasdd-dadsads-ewerdf-111": [
    {
      key: "businessName",
      label: "Nombre del emprendimiento",
      placeholder: "Ej. Artesanías Lupita",
    },
    {
      key: "requestedUse",
      label: "¿En qué utilizarás el apoyo?",
      placeholder: "Describe brevemente el uso del recurso",
    },
  ],
  "sadsasdd-dadsads-ewerdf-222": [
    {
      key: "businessActivity",
      label: "Actividad del negocio",
      placeholder: "Ej. Hospedaje, alimentos o recorridos",
    },
    {
      key: "yearsOperating",
      label: "Tiempo operando",
      placeholder: "Ej. 2 años",
    },
  ],
  "sadsasdd-dadsads-ewerdf-333": [
    {
      key: "adviceTopic",
      label: "Tema de la asesoría",
      placeholder: "Ej. Administración, ventas o costos",
    },
    {
      key: "mainChallenge",
      label: "Principal reto",
      placeholder: "Describe el reto de tu negocio",
    },
  ],
  "sadsasdd-dadsads-ewerdf-444": [
    {
      key: "eventName",
      label: "Nombre del evento",
      placeholder: "Nombre del evento turístico",
    },
    { key: "eventDate", label: "Fecha estimada", placeholder: "DD/MM/AAAA" },
  ],
  "sadsasdd-dadsads-ewerdf-555": [
    {
      key: "financingAmount",
      label: "Monto estimado",
      placeholder: "Ej. $50,000",
    },
    {
      key: "financingPurpose",
      label: "Destino del financiamiento",
      placeholder: "Describe para qué se utilizará",
    },
  ],
  "sadsasdd-dadsads-ewerdf-666": [
    {
      key: "creditPurpose",
      label: "Objetivo del crédito",
      placeholder: "Describe el objetivo",
    },
    {
      key: "monthlyIncome",
      label: "Ingreso mensual estimado",
      placeholder: "Ej. $20,000",
    },
  ],
  "sadsasdd-dadsads-ewerdf-777": [
    {
      key: "projectName",
      label: "Nombre del proyecto",
      placeholder: "Nombre de tu propuesta",
    },
    {
      key: "projectSummary",
      label: "Resumen del proyecto",
      placeholder: "Describe brevemente tu propuesta",
    },
  ],
};

const fallbackDetails = {
  appliesTo: "Personas mayores de edad interesadas en este programa.",
  requirements: [
    "INE vigente",
    "CURP",
    "Comprobante de domicilio",
    "Datos de contacto",
  ],
  opening: "1 de octubre de 2026",
};

const fallbackFields = [
  {
    key: "requestReason",
    label: "Motivo de la solicitud",
    placeholder: "Cuéntanos brevemente qué necesitas",
  },
  {
    key: "expectedBenefit",
    label: "Beneficio esperado",
    placeholder: "Describe el resultado que esperas",
  },
];

type IntroProps = {
  serviceId: string;
  title: string;
  subtitle: string;
  active: boolean;
  onCancel: () => void;
  onStart: () => void;
  showButtons: boolean;
};

export function RequestIntro({
  serviceId,
  title,
  subtitle,
  onCancel,
  onStart,
  showButtons,
}: IntroProps) {
  const detail = DETAILS[serviceId] ?? fallbackDetails;
  const { data: service } = useCatalogService(serviceId);
  const { data: catalogRequirements = [] } = useServiceRequirements(serviceId);
  const requirements = catalogRequirements.length
    ? catalogRequirements
    : detail.requirements.map((name, index) => ({
        id: `fallback-${index}`,
        serviceId,
        name,
        required: true,
        order: index + 1,
      }));
  const now = Date.now();
  const isOpen = Boolean(
    service?.active &&
      (!service.opensAt || now >= new Date(service.opensAt).getTime()) &&
      (!service.closesAt || now <= new Date(service.closesAt).getTime()),
  );

  return (
    <View className="gap-5 rounded-2xl border border-border bg-card p-5">
      <View className="gap-2">
        <View className="self-start rounded-full bg-primary/10 px-3 py-1">
          <Text className="text-xs font-semibold text-primary">
            {isOpen ? "Trámite abierto" : "Trámite cerrado"}
          </Text>
        </View>
        <Text className="text-2xl font-bold text-card-foreground">{title}</Text>
        <Text className="text-muted-foreground">{subtitle}</Text>
      </View>

      <View className="rounded-xl border border-border p-4">
        <Text className="font-semibold">Periodo de atención</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {service?.opensAt ? `Apertura: ${new Date(service.opensAt).toLocaleString("es-MX")}` : "Sin fecha de apertura definida"}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {service?.closesAt ? `Cierre: ${new Date(service.closesAt).toLocaleString("es-MX")}` : "Sin fecha de cierre definida"}
        </Text>
      </View>

      <View className="flex-row gap-3 rounded-xl bg-muted p-4">
        <Monicon name="mdi:cash-remove" size={24} />
        <View className="flex-1">
          <Text className="font-semibold">Costo</Text>
          <Text className="text-muted-foreground">
            {service?.cost || "Gratuito"}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold">¿Para quién aplica?</Text>
        <Text className="text-muted-foreground">
          {service?.targetAudience || detail.appliesTo}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold">Requisitos</Text>
        {requirements.map((requirement) => (
          <View
            key={requirement.id}
            className="flex-row items-start gap-3 rounded-xl bg-muted/60 p-3"
          >
            <Monicon name="mdi:check-circle-outline" size={19} />
            <Text className="flex-1 text-muted-foreground">
              {requirement.name}
            </Text>
          </View>
        ))}
      </View>

      {!isOpen && (
        <View className="rounded-xl border border-amber-400 bg-amber-50 p-4">
          <Text className="font-semibold text-amber-900">
            La convocatoria no está abierta, pero puedes registrar la solicitud.
          </Text>
          <Text className="mt-1 text-amber-800">
            {service?.opensAt && new Date(service.opensAt).getTime() > now
              ? `Se marcará como prioritaria para la apertura del ${new Date(service.opensAt).toLocaleDateString("es-MX")}.`
              : "Se marcará como prioritaria para revisarla cuando el programa vuelva a abrir."}
          </Text>
        </View>
      )}

      {showButtons && (
        <View className="flex-row gap-3">
          <Button variant="outline" onPress={onCancel} className="flex-1">
            <Text>Regresar</Text>
          </Button>
          <Button onPress={onStart} className="flex-1">
            <Text>{isOpen ? "Iniciar trámite" : "Registrar con prioridad"}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

type SpecificProps = {
  serviceId: string;
  title: string;
  values: SpecificRequestData;
  onChange: (values: SpecificRequestData) => void;
};

export function SpecificRequestForm({
  serviceId,
  title,
  values,
  onChange,
}: SpecificProps) {
  const { data: service } = useCatalogService(serviceId);
  const configuredFields = service?.formConfig?.fields;
  const fields = configuredFields?.length
    ? configuredFields
    : (SPECIFIC_FIELDS[serviceId] ?? fallbackFields);
  return (
    <DynamicGlobalForm
      fields={fields}
      values={values}
      onChange={onChange}
      title={`Datos de ${title}`}
      description="Completa la información particular de este trámite."
    />
  );
}

export function isSpecificFormComplete(
  serviceId: string,
  values: SpecificRequestData,
) {
  return (SPECIFIC_FIELDS[serviceId] ?? fallbackFields).every((field) =>
    Boolean(values[field.key]?.trim()),
  );
}

export function RequestSuccess({
  title,
  folio,
  eventFolio,
  priorityOnReopening,
  emailMessage,
  receipt,
  onClose,
  onNew,
}: {
  title: string;
  folio?: string;
  eventFolio?: string;
  priorityOnReopening?: boolean;
  emailMessage?: string;
  receipt?: import("@/src/services/identityApi").RequestReceipt;
  onClose: () => void;
  onNew: () => void;
}) {
  return (
    <View className="items-center gap-4 rounded-2xl border border-border bg-card p-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Monicon name="mdi:check-circle" size={48} />
      </View>
      <Text className="text-center text-2xl font-bold">Solicitud enviada</Text>
      <Text className="text-center text-muted-foreground">
        Tu solicitud de “{title}” se registró correctamente.
      </Text>
      {folio ? (
        <View className="w-full gap-2 rounded-xl bg-muted/60 p-4">
          <View className="flex-row items-center justify-between gap-4">
            <Text className="text-sm text-muted-foreground">Folio de solicitud</Text>
            <Text className="font-semibold text-primary">{folio}</Text>
          </View>
          {eventFolio ? (
            <View className="flex-row items-center justify-between gap-4 border-t border-border pt-2">
              <Text className="text-sm text-muted-foreground">Folio del evento</Text>
              <Text className="font-semibold">{eventFolio}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {priorityOnReopening ? (
        <View className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <Text className="text-center font-semibold text-amber-900">
            Solicitud registrada como prioritaria
          </Text>
          <Text className="mt-1 text-center text-sm text-amber-800">
            La unidad responsable podrá identificarla y atenderla con prioridad.
          </Text>
        </View>
      ) : null}
      {receipt ? (
        <View className="w-full gap-3 rounded-xl border border-border p-4">
          <Text className="font-bold">Comprobante de solicitud</Text>
          <Text>Trámite: {receipt.serviceName}</Text>
          <Text>Estatus: {receipt.status}</Text>
          <Text>
            Fecha y hora: {new Date(receipt.requestedAt).toLocaleString("es-MX")}
          </Text>
          <Text>Atendió: {receipt.attendedBy}</Text>
          <Text>Lugar: {[receipt.eventVenue, receipt.eventLocality, receipt.eventMunicipality].filter(Boolean).join(", ")}</Text>
          <View className="border-t border-border pt-3">
            <Text className="font-semibold">Unidad responsable: {receipt.unitName}</Text>
            {receipt.unitContactName ? <Text>Encargado: {receipt.unitContactName}</Text> : null}
            {receipt.unitContactEmail ? <Text>Correo: {receipt.unitContactEmail}</Text> : null}
            {receipt.unitContactPhone ? <Text>Teléfono: {receipt.unitContactPhone}{receipt.unitContactExtension ? ` ext. ${receipt.unitContactExtension}` : ""}</Text> : null}
          </View>
          <View className="border-t border-border pt-3">
            <Text className="font-semibold">Contacto del trámite</Text>
            {receipt.serviceContactName ? <Text>Responsable: {receipt.serviceContactName}</Text> : null}
            {receipt.serviceContactEmail ? <Text>Correo: {receipt.serviceContactEmail}</Text> : null}
            {receipt.serviceContactPhone ? <Text>Teléfono: {receipt.serviceContactPhone}{receipt.serviceContactExtension ? ` ext. ${receipt.serviceContactExtension}` : ""}</Text> : null}
          </View>
        </View>
      ) : null}
      {emailMessage ? (
        <View className="rounded-xl bg-muted p-4">
          <Text className="text-center text-sm text-muted-foreground">
            {emailMessage}
          </Text>
        </View>
      ) : null}
      <View className="mt-2 w-full gap-3">
        <Button onPress={onClose}>
          <Text>Volver al inicio</Text>
        </Button>
        <Button variant="outline" onPress={onNew}>
          <Text>Nueva solicitud</Text>
        </Button>
      </View>
    </View>
  );
}
