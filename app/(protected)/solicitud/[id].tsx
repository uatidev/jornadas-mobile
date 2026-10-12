import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import { DetailRow, DetailRows } from "@/src/components/modules/mis-solicitudes";
import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents } from "@/src/hooks/useCatalog";
import { useMyRequests, type MyRequestKind } from "@/src/hooks/useMyRequests";
import { useTheme } from "@/src/providers/ThemeProvider";
import { filesService } from "@/src/services/files";
import type { SecretaryRequestDocument } from "@/src/types/request";
import { Monicon } from "@monicon/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SOURCE_LABELS: Record<string, string> = {
  gobernador: "Gobernador",
  oficina_gubernamental: "Oficina gubernamental",
  otra: "Otra procedencia",
};

const ROUTE_LABELS: Record<string, string> = {
  secretaria: "Secretaría",
  canalizacion: "Canalización",
  canalizada: "Canalizada",
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="rounded-2xl bg-card px-4 py-3 dark:border dark:border-border" style={{ boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)" }}>
      <Text className="mb-1 font-bold">{title}</Text>
      {children}
    </View>
  );
}

const openDocument = (document: SecretaryRequestDocument) => {
  if (Platform.OS === "web") {
    void filesService.openAuthenticatedFile(document.fileId, document.type);
    return;
  }
  void Linking.openURL(document.url || filesService.getImageUrl(document.fileId, "request_documents"));
};

export default function RequestDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const params = useLocalSearchParams<{ id: string; kind: MyRequestKind }>();
  const myRequests = useMyRequests();
  const activeEvents = useActiveEvents();
  const item = myRequests.items.find(
    (request) => request.id === params.id && request.kind === params.kind,
  );
  const event = activeEvents.data?.find((current) => current.id === item?.eventId);

  const back = (
    <GlassIconButton
      icon="ic:baseline-arrow-back-ios-new"
      accessibilityLabel="Regresar"
      onPress={() => router.back()}
      size={40}
    />
  );

  if (!item) {
    return (
      <View className="flex-1 bg-background">
        <CollapsingHeaderScrollView title="Detalle" headerLeft={back} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {myRequests.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#981646" />
            </View>
          ) : (
            <View className="items-center rounded-2xl border border-border bg-card px-5 py-10">
              <Text className="font-bold">No encontramos esta solicitud</Text>
              <Pressable onPress={() => router.back()}>
                <Text className="mt-2 text-primary">Regresar</Text>
              </Pressable>
            </View>
          )}
        </CollapsingHeaderScrollView>
      </View>
    );
  }

  const { regular, secretary } = item;

  return (
    <View className="flex-1 bg-background">
      <CollapsingHeaderScrollView
        title={item.folio}
        subtitle={item.title}
        headerLeft={back}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
      >
        <View className="mx-auto w-full max-w-[672px] gap-4">
          <Section title="Resumen">
            <DetailRow label="Estatus" value={item.statusLabel} />
            <DetailRow label="Tipo" value={item.kind === "secretary" ? "Atención de Secretaría" : "Trámite regular"} />
            <DetailRow label="Fecha de captura" value={formatDateTime(item.date)} />
            {event ? <DetailRow label="Evento" value={`${event.name} · ${event.municipality}`} /> : null}
            {item.priority ? (
              <DetailRow label="Prioridad" value={item.kind === "secretary" ? "Alta" : "Prioritaria en reapertura"} />
            ) : null}
            {regular?.eventFolio || secretary?.eventFolio ? (
              <DetailRow label="Folio del evento" value={String(regular?.eventFolio || secretary?.eventFolio)} />
            ) : null}
            <DetailRow label="Folio" value={item.folio} last />
          </Section>

          <Section title="Datos del solicitante">
            <DetailRows
              data={regular?.applicantData ?? secretary?.applicantData}
              labels={myRequests.globalFieldLabels}
            />
          </Section>

          {regular ? (
            <Section title="Datos del trámite">
              <DetailRows
                data={regular.requestData}
                labels={myRequests.serviceFieldLabels[regular.serviceId]}
              />
            </Section>
          ) : null}

          {secretary ? (
            <Section title="Datos de la solicitud">
              <DetailRow label="Asunto" value={secretary.subject} />
              <DetailRow label="Procedencia" value={SOURCE_LABELS[secretary.source] ?? secretary.source} />
              <DetailRow label="Ruta de atención" value={ROUTE_LABELS[secretary.route] ?? secretary.route} />
              {secretary.officeNumber ? <DetailRow label="Número de oficio" value={secretary.officeNumber} /> : null}
              {secretary.officeDate ? (
                <DetailRow label="Fecha del oficio" value={new Date(secretary.officeDate).toLocaleDateString("es-MX")} />
              ) : null}
              <DetailRow label="Capturó" value={secretary.capturedByName} last />
            </Section>
          ) : null}

          {regular?.notes || secretary?.notes ? (
            <Section title="Observaciones">
              <Text className="py-2 text-sm">{regular?.notes || secretary?.notes}</Text>
            </Section>
          ) : null}

          {secretary?.documents.length ? (
            <Section title={`Documentos adjuntos (${secretary.documents.length})`}>
              {secretary.documents.map((document, index) => (
                <Pressable
                  key={document.fileId}
                  onPress={() => openDocument(document)}
                  accessibilityRole="link"
                  className={`flex-row items-center gap-3 py-3 active:opacity-60 ${index < secretary.documents.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <Monicon name="ci:file-document" size={20} color={palette.mutedForeground} />
                  <Text numberOfLines={1} className="flex-1 text-sm">{document.name}</Text>
                  <Monicon name="ci:chevron-right" size={20} color={palette.primary} />
                </Pressable>
              ))}
            </Section>
          ) : null}
        </View>
      </CollapsingHeaderScrollView>
    </View>
  );
}
