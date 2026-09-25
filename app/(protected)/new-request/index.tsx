import { FormHeader } from "@/src/components/common";
import {
  DynamicGlobalForm,
  INEAutoFill,
  isDynamicFormComplete,
  isSpecificFormComplete,
  RequestIntro,
  RequestSuccess,
  SpecificRequestData,
  SpecificRequestForm,
} from "@/src/components/modules/new-request";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { useCatalogService, useGlobalForm } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import type { RequestReceipt } from "@/src/services/identityApi";
import { identityApi } from "@/src/services/identityApi";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const asText = (value: string | string[] | undefined, fallback: string) =>
  Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);

export default function NewRequest() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    serviceId?: string;
    title?: string;
    subtitle?: string;
    active?: string;
    eventId?: string;
  }>();
  const serviceId = asText(params.serviceId, "unknown");
  const eventId = asText(params.eventId, "");
  const title = asText(params.title, "Trámite seleccionado");
  const subtitle = asText(
    params.subtitle,
    "Completa tu solicitud paso a paso.",
  );
  const active = asText(params.active, "true") === "true";
  const { data: service } = useCatalogService(serviceId);
  const { data: globalForm, isLoading: loadingGlobal } = useGlobalForm();
  const [stage, setStage] = useState<
    "intro" | "global" | "specific" | "review" | "success"
  >("intro");
  const [globalData, setGlobalData] = useState<Record<string, string>>({});
  const [specificData, setSpecificData] = useState<SpecificRequestData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folio, setFolio] = useState<string>();
  const [eventFolio, setEventFolio] = useState<string>();
  const [priorityOnReopening, setPriorityOnReopening] = useState(false);
  const [waitingForOpening, setWaitingForOpening] = useState(false);
  const [priorityRequested, setPriorityRequested] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string>();
  const [receipt, setReceipt] = useState<RequestReceipt>();
  const scrollRef = useRef<ScrollView>(null);
  const pendingScrollReset = useRef(false);

  const globalFields = globalForm?.fields || [];
  const forcedInstitutionalPriority = user?.role === "secretaria" || user?.role === "capturista_secretaria";
  const canSetPriority = forcedInstitutionalPriority || user?.role === "enlace";
  const selectedPriority = forcedInstitutionalPriority || priorityRequested;
  const usesGlobalForm = service?.usesGlobalForm ?? true;
  const specificFields = service?.formConfig?.fields || [];
  const globalComplete = isDynamicFormComplete(globalFields, globalData);
  const specificComplete = specificFields.length
    ? specificFields
      .filter((field) => field.required !== false)
      .every((field) => Boolean(specificData[field.key]?.trim()))
    : isSpecificFormComplete(serviceId, specificData);
  const copy = useMemo(
    () => ({
      intro: [
        title,
        "Conoce los requisitos antes de iniciar.",
        "mdi:information-outline",
      ],
      global: [
        "Formulario general",
        "Datos requeridos en todos los trámites.",
        "mdi:account-edit",
      ],
      specific: [
        `Datos de ${title}`,
        "Información particular del trámite.",
        "mdi:file-document-edit",
      ],
      review: [
        "Confirmación",
        "Revisa la información antes de enviarla.",
        "mdi:check-circle",
      ],
      success: [
        "Solicitud enviada",
        "Tu solicitud quedó registrada.",
        "mdi:check-circle",
      ],
    }),
    [title],
  );

  useEffect(() => {
    pendingScrollReset.current = true;
    const interaction = InteractionManager.runAfterInteractions(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 150);
    return () => {
      interaction.cancel();
      clearTimeout(timer);
    };
  }, [stage]);

  const back = () => {
    if (stage === "intro") return router.back();
    if (stage === "global") return setStage("intro");
    if (stage === "specific")
      return setStage(usesGlobalForm ? "global" : "intro");
    if (stage === "review") return setStage("specific");
  };
  const next = () => {
    if (stage === "intro")
      setStage(usesGlobalForm ? "global" : "specific");
    else if (stage === "global" && globalComplete) setStage("specific");
    else if (stage === "specific" && specificComplete) setStage("review");
  };
  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await identityApi.submitRequest(
        serviceId,
        globalData,
        specificData,
        eventId || undefined,
        (() => {
          const field = globalFields.find((item) =>
            /correo|email/i.test(`${item.key} ${item.label}`),
          );
          return field ? globalData[field.key]?.trim() : undefined;
        })(),
        selectedPriority,
      );
      setFolio(result.programFolio || result.eventFolio || result.folio);
      setEventFolio(result.eventFolio);
      setPriorityOnReopening(Boolean(result.priorityOnReopening));
      setWaitingForOpening(Boolean(result.waitingForOpening));
      setEmailMessage(result.emailMessage);
      setReceipt(result.receipt);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["secretaria", "requests"] }),
        queryClient.invalidateQueries({ queryKey: ["gestor", "requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "requests"] }),
        queryClient.invalidateQueries({ queryKey: ["my-captured-requests", user?.id] }),
      ]);
      setStage("success");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible registrar la solicitud",
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const reset = () => {
    setGlobalData({});
    setSpecificData({});
    setError(null);
    setFolio(undefined);
    setEventFolio(undefined);
    setPriorityOnReopening(false);
    setWaitingForOpening(false);
    setPriorityRequested(false);
    setEmailMessage(undefined);
    setReceipt(undefined);
    setStage("intro");
  };
  const step =
    stage === "intro"
      ? 0
      : stage === "global"
        ? 1
        : stage === "specific"
          ? 2
          : 3;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 bg-background">
        <FormHeader
          step={step}
          totalSteps={4}
          title={copy[stage][0]}
          description={copy[stage][1]}
          icon={copy[stage][2]}
          directionName="Nueva solicitud"
          backRoute="/home"
        />
        <ScrollView
          key={stage}
          ref={scrollRef}
          scrollsToTop
          onContentSizeChange={() => {
            if (!pendingScrollReset.current) return;
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            pendingScrollReset.current = false;
          }}
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
        >
          <View className="mx-auto w-full max-w-[672px] gap-6 py-2">
            {stage === "success" ? (
              <RequestSuccess
                title={title}
                folio={folio}
                eventFolio={eventFolio}
                priorityOnReopening={priorityOnReopening}
                waitingForOpening={waitingForOpening}
                emailMessage={emailMessage}
                receipt={receipt}
                onClose={() => router.replace("/home" as any)}
                onNew={reset}
              />
            ) : stage === "intro" ? (
              <RequestIntro
                serviceId={serviceId}
                title={title}
                subtitle={subtitle}
                active={active}
                onCancel={back}
                onStart={next}
                showButtons={false}
              />
            ) : stage === "global" ? (
              loadingGlobal ? (
                <ActivityIndicator color="#981646" />
              ) : (
                <View className="gap-5">
                  {globalForm?.enableINEAnalysis ? (
                    <INEAutoFill
                      fields={globalFields}
                      values={globalData}
                      onChange={setGlobalData}
                    />
                  ) : null}
                  <DynamicGlobalForm
                    fields={globalFields}
                    values={globalData}
                    onChange={setGlobalData}
                  />
                </View>
              )
            ) : stage === "specific" ? (
              <SpecificRequestForm
                serviceId={serviceId}
                title={title}
                values={specificData}
                onChange={setSpecificData}
              />
            ) : (
              <View className="gap-5 rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">
                  Resumen de la solicitud
                </Text>
                <Text className="font-semibold">Datos generales</Text>
                {Object.entries(globalData).map(([key, value]) => (
                  <Text key={key} className="text-muted-foreground">
                    • {value}
                  </Text>
                ))}
                <Text className="mt-2 font-semibold">Datos del trámite</Text>
                {Object.entries(specificData).map(([key, value]) => (
                  <Text key={key} className="text-muted-foreground">
                    • {value}
                  </Text>
                ))}
                {canSetPriority ? (
                  <Pressable
                    disabled={forcedInstitutionalPriority}
                    onPress={() => setPriorityRequested((value) => !value)}
                    className={`mt-3 flex-row items-center gap-3 rounded-xl border p-4 ${selectedPriority ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <View className={`h-5 w-5 items-center justify-center rounded border ${selectedPriority ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {selectedPriority ? <Text className="text-xs font-bold text-primary-foreground">✓</Text> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold">Solicitud prioritaria</Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {forcedInstitutionalPriority
                          ? "Las solicitudes registradas por Secretaría se envían automáticamente como prioritarias."
                          : "Márcala cuando requiera atención prioritaria por parte de la unidad responsable."}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {error ? (
                  <Text className="text-destructive">{error}</Text>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
        {stage !== "success" && (
          <View
            className="absolute bottom-0 left-0 right-0 flex-row gap-4 border-t border-border bg-background px-6 pt-4"
            style={{ paddingBottom: insets.bottom + 8 }}
          >
            <Button variant="outline" onPress={back} className="flex-1">
              <Text>{stage === "intro" ? "Regresar" : "Anterior"}</Text>
            </Button>
            {stage === "review" ? (
              <Button
                onPress={submit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : null}
                <Text>{isSubmitting ? "Enviando..." : "Enviar solicitud"}</Text>
              </Button>
            ) : (
              <Button
                onPress={next}
                disabled={
                  (stage === "global" && !globalComplete) ||
                  (stage === "specific" && !specificComplete)
                }
                className="flex-1"
              >
                <Text>
                  {stage === "intro" ? (active ? "Iniciar trámite" : "Registrar con prioridad") : "Siguiente"}
                </Text>
              </Button>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
