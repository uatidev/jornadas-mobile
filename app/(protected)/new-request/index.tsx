import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import {
  DynamicGlobalForm,
  INEAutoFill,
  isDynamicFormComplete,
  isSpecificFormComplete,
  RequestIntro,
  RequestReview,
  RequestSuccess,
  SpecificRequestData,
  SpecificRequestForm,
  useSpecificFields,
} from "@/src/components/modules/new-request";
import { THEME } from "@/src/components/ui/lib/theme";
import { Progress } from "@/src/components/ui/progress";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents, useCatalogService, useGlobalForm } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
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
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
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
  const specificFields = useSpecificFields(serviceId);
  const { data: activeEvents } = useActiveEvents();
  const event = activeEvents?.find((item) => item.id === eventId);
  const eventName = event ? `${event.name} · ${event.municipality}` : undefined;
  const globalComplete = isDynamicFormComplete(globalFields, globalData);
  const specificComplete = service?.formConfig?.fields?.length
    ? specificFields
      .filter((field) => field.required !== false)
      .every((field) => Boolean(specificData[field.key]?.trim()))
    : isSpecificFormComplete(serviceId, specificData);
  const copy = useMemo(
    () => ({
      intro: [
        title,
        "Conoce los requisitos antes de iniciar."
      ],
      global: [
        "Formulario general",
        "Datos requeridos en todos los trámites."
      ],
      specific: [
        `Datos de ${title}`,
        "Información particular del trámite."
      ],
      review: [
        "Confirmación",
        "Revisa la información antes de enviarla."
      ],
      success: [
        "Solicitud enviada",
        "Tu solicitud quedó registrada."
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
        <CollapsingHeaderScrollView
          key={stage}
          ref={scrollRef}
          title={copy[stage][0]}
          subtitle={copy[stage][1]}
          largeTitleAlign="center"
          headerLeft={
            <GlassIconButton
              icon="ic:baseline-arrow-back-ios-new"
              accessibilityLabel="Salir de la solicitud"
              onPress={() => router.back()}
              size={40}
            />
          }
          scrollsToTop
          // Sin esto, con el teclado abierto el primer toque solo lo cierra y
          // hay que tocar dos veces los botones.
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!pendingScrollReset.current) return;
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            pendingScrollReset.current = false;
          }}
          contentContainerStyle={{
            paddingHorizontal: stage === "success" ? 28 : 16,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View className="mx-auto w-full max-w-[672px] gap-6 py-2">
            {stage !== "success" ? (
              <View className="gap-2">
                <Text className="text-center text-sm text-muted-foreground">
                  Paso {step + 1} de 4
                </Text>
                <Progress
                  value={((step + 1) / 4) * 100}
                  className="bg-muted"
                  gradientColors={[palette.primary, palette.primary]}
                />
              </View>
            ) : null}
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
                    appearance="glass"
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
              <RequestReview
                serviceTitle={title}
                eventName={eventName}
                globalFields={globalFields}
                globalData={globalData}
                specificFields={specificFields}
                specificData={specificData}
                onEditGlobal={usesGlobalForm ? () => setStage("global") : undefined}
                onEditSpecific={() => setStage("specific")}
                canSetPriority={canSetPriority}
                forcedPriority={forcedInstitutionalPriority}
                priority={selectedPriority}
                onPriorityChange={setPriorityRequested}
                error={error}
              />
            )}

            {/* Navegación al final del contenido (no fija): X / < para salir o
                regresar y > para avanzar o enviar. */}
            {stage !== "success" && (
              <View className="flex-row items-center justify-center gap-6 pt-2">
                <GlassIconButton
                  icon={stage === "intro" ? "mdi:close" : "ci:chevron-left"}
                  accessibilityLabel={stage === "intro" ? "Cancelar" : "Anterior"}
                  onPress={back}
                  disabled={isSubmitting}
                />
                {stage === "review" ? (
                  <GlassIconButton
                    variant="primary"
                    icon="mdi:check"
                    accessibilityLabel="Enviar solicitud"
                    onPress={submit}
                    loading={isSubmitting}
                  />
                ) : (
                  <GlassIconButton
                    variant="primary"
                    icon="ci:chevron-right"
                    accessibilityLabel={
                      stage === "intro"
                        ? active
                          ? "Iniciar trámite"
                          : "Registrar con prioridad"
                        : "Siguiente"
                    }
                    onPress={next}
                    disabled={
                      (stage === "global" && !globalComplete) ||
                      (stage === "specific" && !specificComplete)
                    }
                  />
                )}
              </View>
            )}
          </View>
        </CollapsingHeaderScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
