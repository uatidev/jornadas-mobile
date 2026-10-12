import { INEScannerCamera } from "@/src/components/modules/INEScannerCamera";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import type { ServiceFormField } from "@/src/types/catalog";
import { processINE } from "@/src/utils/functions";
import { useState } from "react";
import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

export function INEAutoFill({
  fields,
  values,
  onChange,
}: {
  fields: ServiceFormField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const findField = (...terms: string[]) =>
    fields.find((field) => {
      const identity = normalize(`${field.key} ${field.label}`);
      return terms.some((term) => identity.includes(term));
    });

  const handleScan = async (
    file: File | { uri: string; name: string; type: string },
    setScannerLoading: (value: boolean) => void,
  ) => {
    setLoading(true);
    setScannerLoading(true);
    setMessage(null);
    setSuccess(false);
    try {
      const result = await processINE(file);
      if (!result)
        throw new Error(
          "No se pudieron reconocer los datos. Intenta con una imagen más clara.",
        );

      const next = { ...values };
      const assignments: [ServiceFormField | undefined, string | undefined][] =
        [
          [findField("primernombre", "nombres", "nombre"), result.nombre],
          [
            findField("primerapellido", "apellidopaterno"),
            result.primerApellido,
          ],
          [
            findField("segundoapellido", "apellidomaterno"),
            result.segundoApellido,
          ],
          [findField("curp"), result.curp],
          [findField("direccion", "domicilio"), result.direccion],
          [findField("genero", "sexo"), result.genero],
          [findField("edad"), result.edad],
        ];
      let recognized = 0;
      for (const [field, value] of assignments) {
        if (field && value?.trim()) {
          next[field.key] = value.trim();
          recognized += 1;
        }
      }
      if (!recognized)
        throw new Error(
          "Se analizó la INE, pero el formulario no contiene campos compatibles.",
        );
      onChange(next);
      setSuccess(true);
      setMessage(
        `Se completaron ${recognized} campos. Revisa los datos antes de continuar.`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "No fue posible analizar la INE.",
      );
    } finally {
      setLoading(false);
      setScannerLoading(false);
    }
  };

  return (
    <View className="bg-card dark:border dark:border-border" style={styles.card}>
      <View style={styles.header}>
        <View className="items-center justify-center rounded-full bg-primary/10" style={styles.iconCircle}>
          <Monicon name="mdi:card-account-details" size={22} color={palette.primary} />
        </View>
        <View style={styles.texts}>
          <Text className="font-bold">Completar con la INE</Text>
          <Text className="text-xs text-muted-foreground">
            Escanea el frente para llenar nombre, apellidos, CURP y domicilio.
            Después podrás corregir cualquier dato.
          </Text>
        </View>
      </View>
      <INEScannerCamera
        onScan={handleScan}
        setLoadingOCR={setLoading}
        setFormData={() => undefined}
        renderButton={({ openCameraOrPicker }) => (
          <Button onPress={openCameraOrPicker} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="white" /> : null}
            <Text>
              {loading ? "Analizando INE..." : "Escanear y analizar INE"}
            </Text>
          </Button>
        )}
      />
      {message ? (
        <Text
          className={
            success
              ? "text-sm text-emerald-700 dark:text-emerald-400"
              : "text-sm text-destructive"
          }
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
});
