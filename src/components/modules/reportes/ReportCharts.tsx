import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import type { ReportDatum, SplitDatum } from "@/src/hooks/useReportes";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

/**
 * Paleta categórica validada (banda de luminosidad, croma, separación para
 * daltonismo y contraste) contra la superficie clara y la oscura. El orden es
 * fijo: el primer color siempre es el guinda institucional.
 */
export const CATEGORICAL = {
  light: ["#981646", "#2563eb", "#a77a2e", "#0d9488", "#7c3aed", "#c2410c"],
  dark: ["#d6336c", "#3b82f6", "#b8893a", "#0d9e8f", "#8b5cf6", "#ea580c"],
};
/** Color de la categoría agrupada "Otros". */
export const OTHER_COLOR = { light: "#a1a1aa", dark: "#52525b" };
export const MAX_SLICES = CATEGORICAL.light.length;

/**
 * Series fijas del desglose por tipo de solicitud: el color sigue a la serie, no
 * a su posición. "Trámites" incluye los capturados por personal de Secretaría;
 * "Atención de Secretaría" son las solicitudes del formulario de Secretaría.
 */
export const SPLIT_SERIES = [
  { key: "regular", label: "Trámites", colorIndex: 0 },
  { key: "secretary", label: "Atención de Secretaría", colorIndex: 1 },
] as const;

export function useChartColors() {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  return {
    series: CATEGORICAL[colorScheme],
    other: OTHER_COLOR[colorScheme],
    primary: CATEGORICAL[colorScheme][0],
    surface: palette.card,
    track: colorScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
  };
}

/** Agrupa las categorías que no caben en la paleta dentro de "Otros". */
export function foldOthers<T extends ReportDatum>(data: T[]): ReportDatum[] {
  if (data.length <= MAX_SLICES) return data;
  const head = data.slice(0, MAX_SLICES - 1);
  const rest = data.slice(MAX_SLICES - 1).reduce((sum, item) => sum + item.value, 0);
  return [...head, { key: "__otros", label: "Otros", value: rest }];
}

export const percent = (value: number, total: number) =>
  total ? `${Math.round((value / total) * 100)}%` : "0%";

/**
 * Tarjeta de Reportes con el mismo estilo que Configuración y el catálogo del
 * home: fondo de tarjeta, sombra suave y borde solo en modo oscuro.
 */
export function ReportCard({ className = "", style, children }: {
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View className={`mb-4 bg-card dark:border dark:border-border ${className}`} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ReportCard className="p-4">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      {subtitle ? <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text> : null}
      <View className="mt-4">{children}</View>
    </ReportCard>
  );
}

export function EmptyChart() {
  return (
    <View className="h-24 items-center justify-center rounded-2xl bg-muted">
      <Text className="text-sm text-muted-foreground">Sin datos para este filtro</Text>
    </View>
  );
}

function LegendRow({ color, label, value, total, selected, onPress }: {
  color: string;
  label: string;
  value: number;
  total: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}, ${percent(value, total)}`}
      className={`flex-row items-center gap-2 rounded-xl px-2 py-1.5 ${selected ? "bg-muted" : ""}`}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text numberOfLines={1} className="flex-1 text-sm text-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
      <Text className="w-10 text-right text-xs text-muted-foreground">{percent(value, total)}</Text>
    </Pressable>
  );
}

/** Dona con total al centro y leyenda; al tocar un segmento o fila se resalta. */
export function DonutChart({ data, centerLabel = "Total" }: { data: ReportDatum[]; centerLabel?: string }) {
  const colors = useChartColors();
  const [selected, setSelected] = useState<string | null>(null);
  // El color se asigna antes de filtrar ceros para que cada categoría conserve el suyo.
  const slices = foldOthers(data)
    .map((item, index) => ({ ...item, color: item.key === "__otros" ? colors.other : colors.series[index] }))
    .filter((item) => item.value > 0);
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <EmptyChart />;

  const size = 180;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Separación de 2px entre segmentos (solo si hay más de uno).
  const gap = slices.length > 1 ? 2 : 0;
  const active = slices.find((item) => item.key === selected);
  // Inicio de cada segmento sobre la circunferencia.
  const offsets = slices.map((_, index) =>
    slices.slice(0, index).reduce((sum, item) => sum + (item.value / total) * circumference, 0),
  );
  const toggle = (key: string) => setSelected(selected === key ? null : key);

  return (
    <View>
      <View className="items-center">
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.track} strokeWidth={stroke} fill="none" />
            {slices.map((item, index) => {
              const dash = Math.max((item.value / total) * circumference - gap, 0.5);
              return (
                <Circle
                  key={item.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={selected === item.key ? stroke + 4 : stroke}
                  strokeOpacity={selected && selected !== item.key ? 0.35 : 1}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsets[index]}
                  fill="none"
                  onPress={() => toggle(item.key)}
                />
              );
            })}
          </Svg>
          {/* Ocupa todo el cuadro para quedar centrado dentro del hueco de la dona. */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: stroke + 12 }]}
          >
            <Text className="text-3xl font-bold text-foreground">{active ? active.value : total}</Text>
            <Text numberOfLines={2} className="text-center text-xs text-muted-foreground">
              {active ? active.label : centerLabel}
            </Text>
          </View>
        </View>
      </View>
      <View className="mt-4 gap-0.5">
        {slices.map((item) => (
          <LegendRow
            key={item.key}
            color={item.color}
            label={item.label}
            value={item.value}
            total={total}
            selected={selected === item.key}
            onPress={() => toggle(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

/** Barras horizontales de una sola serie (ranking). */
export function HorizontalBarChart({ data, limit = 8 }: { data: ReportDatum[]; limit?: number }) {
  const colors = useChartColors();
  const items = data.filter((item) => item.value > 0).slice(0, limit);
  const max = Math.max(...items.map((item) => item.value), 0);
  if (!max) return <EmptyChart />;

  return (
    <View className="gap-3">
      {items.map((item) => (
        <View key={item.key} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
          <View className="mb-1 flex-row items-end gap-2">
            <Text numberOfLines={2} className="flex-1 text-xs text-muted-foreground">{item.label}</Text>
            <Text className="text-sm font-semibold text-foreground">{item.value}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 4, backgroundColor: colors.track }}>
            <View
              style={{
                height: 10,
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>
      ))}
      {data.length > limit ? (
        <Text className="text-xs text-muted-foreground">Mostrando los {limit} principales de {data.length}.</Text>
      ) : null}
    </View>
  );
}

/**
 * Barras horizontales apiladas Trámites + Secretaría. Al tocar una fila se
 * muestra el desglose de ambas series.
 */
export function StackedBarChart({ data, limit = 8, showLegend = true }: {
  data: SplitDatum[];
  limit?: number;
  showLegend?: boolean;
}) {
  const colors = useChartColors();
  const [selected, setSelected] = useState<string | null>(null);
  const items = data.filter((item) => item.value > 0).slice(0, limit);
  const max = Math.max(...items.map((item) => item.value), 0);
  if (!max) return <EmptyChart />;
  const series = SPLIT_SERIES.filter((serie) => items.some((item) => item[serie.key] > 0));

  return (
    <View className="gap-3">
      {showLegend && series.length > 1 ? (
        <View className="flex-row gap-4">
          {series.map((serie) => (
            <View key={serie.key} className="flex-row items-center gap-1.5">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.series[serie.colorIndex] }} />
              <Text className="text-xs text-muted-foreground">{serie.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}: ${item.value}. Trámites ${item.regular}, Atención de Secretaría ${item.secretary}`}
          onPress={() => setSelected(selected === item.key ? null : item.key)}
        >
          <View className="mb-1 flex-row items-end gap-2">
            <Text numberOfLines={2} className="flex-1 text-xs text-muted-foreground">{item.label}</Text>
            <Text className="text-sm font-semibold text-foreground">{item.value}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 4, backgroundColor: colors.track }}>
            <View
              className="flex-row"
              style={{ height: 10, width: `${Math.max((item.value / max) * 100, 2)}%`, gap: 2 }}
            >
              {SPLIT_SERIES.filter((serie) => item[serie.key] > 0).map((serie) => (
                <View
                  key={serie.key}
                  style={{ flex: item[serie.key], borderRadius: 4, backgroundColor: colors.series[serie.colorIndex] }}
                />
              ))}
            </View>
          </View>
          {selected === item.key ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              Trámites {item.regular} · Atención de Secretaría {item.secretary}
            </Text>
          ) : null}
        </Pressable>
      ))}
      {data.length > limit ? (
        <Text className="text-xs text-muted-foreground">Mostrando los {limit} principales de {data.length}.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
});
