import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import { TourCard, TourTarget, useTourTargets } from "@/src/components/common/SpotlightTour";
import { DynamicGlobalForm, RequestReview } from "@/src/components/modules/new-request";
import { Button } from "@/src/components/ui/button";
import { THEME } from "@/src/components/ui/lib/theme";
import { Progress } from "@/src/components/ui/progress";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { ServiceFormField } from "@/src/types/catalog";
import Monicon from "@monicon/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Trámite ficticio para la guía. No usa el catálogo ni Appwrite: nada de lo que
 * se capture aquí se envía ni se guarda.
 */
const EXAMPLE_TITLE = "Apoyo a emprendedores (ejemplo)";
const EXAMPLE_FOLIO = "EJ-000123";

const REQUIREMENTS = [
  "INE vigente del solicitante",
  "Comprobante de domicilio reciente",
  "Fotografía del negocio",
];

const GLOBAL_FIELDS: ServiceFormField[] = [
  { key: "nombre", label: "Nombre(s)", type: "text", required: true },
  { key: "primerApellido", label: "Primer apellido", type: "text", required: true },
  { key: "segundoApellido", label: "Segundo apellido", type: "text", required: false },
  { key: "curp", label: "CURP", type: "text", required: true },
  { key: "telefono", label: "Teléfono", type: "tel", required: true },
  { key: "correo", label: "Correo electrónico", type: "email", required: false },
];

const SPECIFIC_FIELDS: ServiceFormField[] = [
  { key: "negocio", label: "Nombre del negocio", type: "text", required: true },
  {
    key: "giro",
    label: "Giro del negocio",
    type: "select",
    required: true,
    options: ["Alimentos", "Artesanías", "Hospedaje", "Servicios turísticos"],
  },
  { key: "descripcion", label: "¿Para qué usará el apoyo?", type: "textarea", required: true },
];

const EXAMPLE_GLOBAL_DATA: Record<string, string> = {
  nombre: "María",
  primerApellido: "Pérez",
  segundoApellido: "López",
  curp: "PELM900101MTCRPR09",
  telefono: "9931234567",
  correo: "maria.perez@ejemplo.com",
};

const EXAMPLE_SPECIFIC_DATA: Record<string, string> = {
  negocio: "Cocina Doña Mary",
  giro: "Alimentos",
  descripcion: "Comprar una estufa industrial para ampliar la producción.",
};

type Stage = "intro" | "global" | "specific" | "review" | "success";

const STAGES: Stage[] = ["intro", "global", "specific", "review"];

const STAGE_COPY: Record<Stage, [string, string]> = {
  intro: [EXAMPLE_TITLE, "Conoce los requisitos antes de iniciar."],
  global: ["Formulario general", "Datos requeridos en todos los trámites."],
  specific: ["Datos del trámite", "Información particular del trámite."],
  review: ["Confirmación", "Revisa la información antes de enviarla."],
  success: ["Solicitud enviada", "Así se ve una solicitud registrada."],
};

type Step = { target: string; stage: Stage; title: string; body: string };

const STEPS: Step[] = [
  {
    target: "banner",
    stage: "intro",
    title: "Trámite de ejemplo",
    body: "Esta guía usa un trámite ficticio para mostrarte cómo se registra una solicitud. Nada de lo que veas o captures aquí se envía ni se guarda.",
  },
  {
    target: "progress",
    stage: "intro",
    title: "Avance del trámite",
    body: "Todos los trámites tienen 4 pasos: requisitos, datos generales, datos del trámite y confirmación. Aquí ves en cuál vas.",
  },
  {
    target: "requirements",
    stage: "intro",
    title: "Requisitos",
    body: "Antes de iniciar, confirma que la persona tenga estos documentos. Así evitas regresar a mitad del registro.",
  },
  {
    target: "nav",
    stage: "intro",
    title: "Avanzar y regresar",
    body: "La flecha avanza al siguiente paso. La X cancela el trámite y, en los demás pasos, la flecha izquierda regresa al anterior.",
  },
  {
    target: "ine",
    stage: "global",
    title: "Escaneo de INE",
    body: "Cuando está habilitado, puedes fotografiar la INE para llenar nombre, CURP y otros datos automáticamente. Revisa siempre lo que se llenó.",
  },
  {
    target: "global-form",
    stage: "global",
    title: "Datos generales",
    body: "Son los mismos en todos los trámites. Los campos con * son obligatorios: la flecha para avanzar se activa cuando están completos.",
  },
  {
    target: "specific-form",
    stage: "specific",
    title: "Datos del trámite",
    body: "Cada trámite pide su propia información. En este ejemplo, los datos del negocio y para qué se usará el apoyo.",
  },
  {
    target: "review",
    stage: "review",
    title: "Confirmación",
    body: "Revisa la información con la persona antes de enviar. Con «Editar» en cada sección regresas a corregirla.",
  },
  {
    target: "nav",
    stage: "review",
    title: "Enviar la solicitud",
    body: "La palomita envía la solicitud y genera el folio. En esta guía el envío está desactivado.",
  },
  {
    target: "folio",
    stage: "success",
    title: "Folio de la solicitud",
    body: "Al enviar recibes un folio. Compártelo con la persona para que dé seguimiento. También lo encuentras en «Mis solicitudes».",
  },
];

/** Separación entre el elemento señalado y el encabezado o la tarjeta de la guía. */
const VISIBLE_MARGIN = 16;

export default function GuiaTramiteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const rootRef = useRef<View>(null);
  const { targetRef, measure } = useTourTargets(rootRef);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  const [stage, setStage] = useState<Stage>("intro");
  const [globalData, setGlobalData] = useState(EXAMPLE_GLOBAL_DATA);
  const [specificData, setSpecificData] = useState(EXAMPLE_SPECIFIC_DATA);
  // La guía empieza cuando termina la transición de entrada de la pantalla.
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  const step = stepIndex !== null ? STEPS[stepIndex] : null;
  const progressIndex = Math.max(STAGES.indexOf(stage), 0);

  /** Desplaza la pantalla para que el elemento quede entre el encabezado y la tarjeta. */
  const focus = useCallback(
    async (target: string) => {
      const rect = await measure(target);
      if (!rect) return;
      const top = headerHeight + VISIBLE_MARGIN;
      const bottom = height - cardHeight - insets.bottom - 12 - VISIBLE_MARGIN;
      const fits = rect.height <= bottom - top;
      if (rect.y < top || (fits && rect.y + rect.height > bottom) || (!fits && rect.y > top)) {
        scrollRef.current?.scrollTo({ y: Math.max(scrollY.current + rect.y - top, 0), animated: true });
      }
    },
    [measure, headerHeight, height, cardHeight, insets.bottom],
  );

  /** Cambia de paso y muestra la etapa a la que pertenece. */
  const goToStep = (index: number | null) => {
    setStepIndex(index);
    if (index !== null) setStage(STEPS[index].stage);
  };

  useEffect(() => {
    const timer = setTimeout(() => setStepIndex(0), 450);
    return () => clearTimeout(timer);
  }, []);

  // Con la etapa ya dibujada, se lleva el elemento del paso a la vista.
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(() => void focus(step.target), 250);
    return () => clearTimeout(timer);
  }, [step, focus]);

  // Cada etapa empieza arriba.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.current = 0;
  }, [stage]);

  const restart = () => {
    setGlobalData(EXAMPLE_GLOBAL_DATA);
    setSpecificData(EXAMPLE_SPECIFIC_DATA);
    goToStep(0);
  };

  const next = () => {
    const index = STAGES.indexOf(stage);
    setStage(index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : "success");
  };
  const back = () => {
    const index = STAGES.indexOf(stage);
    if (index <= 0) router.back();
    else setStage(STAGES[index - 1]);
  };

  return (
    <View
      ref={rootRef}
      collapsable={false}
      className="flex-1 bg-background"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <View
        className="flex-row items-center gap-3 px-4 pb-2"
        style={{ paddingTop: insets.top + 8 }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <GlassIconButton
          icon="ic:baseline-arrow-back-ios-new"
          accessibilityLabel="Salir de la guía"
          onPress={() => router.back()}
          size={40}
        />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-lg font-semibold text-foreground">{STAGE_COPY[stage][0]}</Text>
          <Text numberOfLines={1} className="text-xs text-muted-foreground">{STAGE_COPY[stage][1]}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        // Con la guía abierta se deja espacio para desplazar el contenido por encima de la tarjeta.
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24 + (step ? cardHeight + 12 : 0),
        }}
      >
        {/* Con la guía abierta el contenido se ve y se desplaza, pero no se edita. */}
        <View
          pointerEvents={step ? "none" : "auto"}
          className="mx-auto w-full max-w-[672px] gap-6 py-2"
        >
          <TourTarget id="banner" activeId={step?.target} targetRef={targetRef} className="flex-row items-center gap-3 rounded-2xl bg-primary/10 p-4">
            <Monicon name="mdi:information-outline" size={22} color={palette.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Trámite de ejemplo</Text>
              <Text className="text-xs text-muted-foreground">Nada de lo que captures aquí se envía ni se guarda.</Text>
            </View>
          </TourTarget>

          {stage !== "success" ? (
            <TourTarget id="progress" activeId={step?.target} targetRef={targetRef} className="gap-2">
              <Text className="text-center text-sm text-muted-foreground">
                Paso {progressIndex + 1} de 4
              </Text>
              <Progress
                value={((progressIndex + 1) / 4) * 100}
                className="bg-muted"
                gradientColors={[palette.primary, palette.primary]}
              />
            </TourTarget>
          ) : null}

          {stage === "intro" ? (
            <TourTarget id="requirements" activeId={step?.target} targetRef={targetRef} className="rounded-3xl border border-border bg-card p-5">
              <Text className="text-base font-semibold text-foreground">Requisitos</Text>
              <Text className="mt-1 text-xs text-muted-foreground">Ten a la mano estos documentos.</Text>
              <View className="mt-4 gap-3">
                {REQUIREMENTS.map((requirement) => (
                  <View key={requirement} className="flex-row items-center gap-3">
                    <Monicon name="mdi:check-circle-outline" size={20} color={palette.primary} />
                    <Text className="flex-1 text-sm text-foreground">{requirement}</Text>
                  </View>
                ))}
              </View>
            </TourTarget>
          ) : stage === "global" ? (
            <View className="gap-5">
              <TourTarget id="ine" activeId={step?.target} targetRef={targetRef} className="flex-row items-center gap-3 rounded-3xl border border-border bg-card p-5">
                <View className="size-11 items-center justify-center rounded-full bg-primary/10">
                  <Monicon name="mdi:card-account-details" size={22} color={palette.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Escanear INE</Text>
                  <Text className="text-xs text-muted-foreground">Llena los datos con una foto de la credencial.</Text>
                </View>
              </TourTarget>
              <TourTarget id="global-form" activeId={step?.target} targetRef={targetRef}>
                <DynamicGlobalForm
                  appearance="glass"
                  fields={GLOBAL_FIELDS}
                  values={globalData}
                  onChange={setGlobalData}
                />
              </TourTarget>
            </View>
          ) : stage === "specific" ? (
            <TourTarget id="specific-form" activeId={step?.target} targetRef={targetRef}>
              <DynamicGlobalForm
                appearance="glass"
                title={`Datos de ${EXAMPLE_TITLE}`}
                description="Información particular de este trámite."
                fields={SPECIFIC_FIELDS}
                values={specificData}
                onChange={setSpecificData}
              />
            </TourTarget>
          ) : stage === "review" ? (
            <TourTarget id="review" activeId={step?.target} targetRef={targetRef}>
              <RequestReview
                serviceTitle={EXAMPLE_TITLE}
                eventName="Jornada de ejemplo · Centro"
                globalFields={GLOBAL_FIELDS}
                globalData={globalData}
                specificFields={SPECIFIC_FIELDS}
                specificData={specificData}
                onEditGlobal={() => setStage("global")}
                onEditSpecific={() => setStage("specific")}
                canSetPriority={false}
                forcedPriority={false}
                priority={false}
                onPriorityChange={() => {}}
              />
            </TourTarget>
          ) : (
            <View className="items-center gap-4 py-6">
              <View className="size-20 items-center justify-center rounded-full bg-primary/10">
                <Monicon name="mdi:check-circle" size={44} color={palette.primary} />
              </View>
              <Text className="text-center text-xl font-semibold text-foreground">Solicitud registrada</Text>
              <TourTarget id="folio" activeId={step?.target} targetRef={targetRef} className="w-full items-center rounded-3xl border border-border bg-card p-5">
                <Text className="text-xs text-muted-foreground">Folio de la solicitud</Text>
                <Text className="mt-1 text-2xl font-semibold tracking-wider text-foreground">{EXAMPLE_FOLIO}</Text>
                <Text className="mt-2 text-center text-xs text-muted-foreground">
                  Folio de ejemplo: en un trámite real lo genera el sistema.
                </Text>
              </TourTarget>
              <View className="w-full gap-3">
                <Button onPress={() => router.back()}>
                  <Text>Terminar guía</Text>
                </Button>
                <Button variant="outline" onPress={restart}>
                  <Text>Ver la guía otra vez</Text>
                </Button>
              </View>
            </View>
          )}

          {stage !== "success" ? (
            <TourTarget id="nav" activeId={step?.target} targetRef={targetRef} className="flex-row items-center justify-center gap-6 self-center pt-2">
              <GlassIconButton
                icon={stage === "intro" ? "mdi:close" : "ci:chevron-left"}
                accessibilityLabel={stage === "intro" ? "Salir de la guía" : "Anterior"}
                onPress={back}
              />
              <GlassIconButton
                variant="primary"
                icon={stage === "review" ? "mdi:check" : "ci:chevron-right"}
                accessibilityLabel={stage === "review" ? "Enviar solicitud de ejemplo" : "Siguiente"}
                onPress={next}
              />
            </TourTarget>
          ) : null}
        </View>
      </ScrollView>

      {step && stepIndex !== null ? (
        <TourCard
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          title={step.title}
          body={step.body}
          index={stepIndex}
          total={STEPS.length}
          onNext={() => goToStep(stepIndex < STEPS.length - 1 ? stepIndex + 1 : null)}
          onPrev={() => goToStep(Math.max(stepIndex - 1, 0))}
          onSkip={() => goToStep(null)}
        />
      ) : null}
    </View>
  );
}
