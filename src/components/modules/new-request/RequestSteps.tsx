import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import {
  useCatalogService,
  useServiceRequirements,
} from "@/src/hooks/useCatalog";
import {
  SERVICE_STATUS_DOT_COLOR,
  SERVICE_STATUS_LABEL,
  getServiceStatus,
} from "@/src/components/modules/home/ServiceCard";
import { SettingsCard, SettingsRow } from "@/src/components/modules/gestionar-cuenta/SettingsCard";
import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ServiceFormField } from "@/src/types/catalog";
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
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  // Hora fija al montar: el estado no debe cambiar entre renders.
  const [now] = useState(() => Date.now());
  const status = service ? getServiceStatus(service, now) : "open";
  const isOpen = status === "open";
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const period =
    service?.opensAt && service?.closesAt
      ? `Del ${formatDate(service.opensAt)} al ${formatDate(service.closesAt)}`
      : service?.opensAt
        ? `A partir del ${formatDate(service.opensAt)}`
        : service?.closesAt
          ? `Hasta el ${formatDate(service.closesAt)}`
          : "Sin fechas definidas";

  return (
    <View style={styles.container}>
      <View className="bg-card dark:border dark:border-border" style={[styles.card, styles.hero]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: SERVICE_STATUS_DOT_COLOR[status] }]} />
          <Text className="text-xs font-medium text-muted-foreground">
            {SERVICE_STATUS_LABEL[status]}
          </Text>
        </View>
        <Text className="text-xl font-bold text-card-foreground">{title}</Text>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>

      <SettingsCard title="Información">
        <SettingsRow icon="ci:calendar-event" title="Periodo de atención" description={period} />
        <SettingsRow icon="mdi:cash-remove" title="Costo" description={service?.cost || "Gratuito"} isLast />
      </SettingsCard>

      <SettingsCard title="¿Para quién aplica?">
        <Text className="text-sm text-foreground" style={styles.cardText}>
          {service?.targetAudience || detail.appliesTo}
        </Text>
      </SettingsCard>

      <SettingsCard title={`Requisitos (${requirements.length})`}>
        <View style={styles.requirements}>
          {requirements.map((requirement, index) => (
            <View
              key={requirement.id}
              style={[
                styles.requirement,
                index < requirements.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.border,
                },
              ]}
            >
              <Monicon name="mdi:check-circle-outline" size={20} color={palette.primary} />
              <Text className="flex-1 text-sm text-foreground">{requirement.name}</Text>
            </View>
          ))}
        </View>
      </SettingsCard>

      {!isOpen && (
        <View className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <Text className="font-semibold text-amber-900 dark:text-amber-200">
            La convocatoria no está abierta, pero puedes registrar la solicitud.
          </Text>
          <Text className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {service?.opensAt && new Date(service.opensAt).getTime() > now
              ? `Quedará en espera para revisarla a partir del ${formatDate(service.opensAt)}.`
              : "Quedará en espera para revisarla cuando el programa vuelva a abrir."}
          </Text>
        </View>
      )}

      {showButtons && (
        <View className="flex-row gap-3">
          <Button variant="outline" onPress={onCancel} className="flex-1">
            <Text>Regresar</Text>
          </Button>
          <Button onPress={onStart} className="flex-1">
            <Text>{isOpen ? "Iniciar trámite" : "Registrar para próxima apertura"}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  hero: {
    gap: 6,
    padding: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardText: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    lineHeight: 20,
  },
  requirements: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
});

type SpecificProps = {
  serviceId: string;
  title: string;
  values: SpecificRequestData;
  onChange: (values: SpecificRequestData) => void;
};

/** Campos del formulario particular de un trámite (configurados o predeterminados). */
export function useSpecificFields(serviceId: string): ServiceFormField[] {
  const { data: service } = useCatalogService(serviceId);
  const configuredFields = service?.formConfig?.fields;
  return configuredFields?.length
    ? configuredFields
    : (SPECIFIC_FIELDS[serviceId] ?? fallbackFields);
}

export function SpecificRequestForm({
  serviceId,
  title,
  values,
  onChange,
}: SpecificProps) {
  const fields = useSpecificFields(serviceId);
  return (
    <DynamicGlobalForm
      appearance="glass"
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
  waitingForOpening,
  emailMessage,
  receipt,
  onClose,
  onNew,
}: {
  title: string;
  folio?: string;
  eventFolio?: string;
  priorityOnReopening?: boolean;
  waitingForOpening?: boolean;
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
      {waitingForOpening ? (
        <View className="rounded-xl border border-blue-300 bg-blue-50 p-4">
          <Text className="text-center font-semibold text-blue-900">En espera de apertura</Text>
          <Text className="mt-1 text-center text-sm text-blue-800">La solicitud será revisada cuando el programa vuelva a estar disponible.</Text>
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
