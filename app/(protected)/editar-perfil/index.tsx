import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import { GlassInput } from "@/src/components/common/GlassInput";
import { SettingsCard, getProfilePhotoUrl } from "@/src/components/modules/gestionar-cuenta";
import { Button } from "@/src/components/ui/button";
import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useGestionarCuenta } from "@/src/hooks/useGestionarCuenta";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { authService } from "@/src/services/auth";
import { filesService } from "@/src/services/files";
import { showImagePickerOptions } from "@/src/utils/imagePicker";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function SaveButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Button onPress={onPress} disabled={disabled || loading}>
      {loading ? <ActivityIndicator size="small" color="white" /> : null}
      <Text>{loading ? "Guardando..." : label}</Text>
    </Button>
  );
}

function CardBody({ children }: { children: ReactNode }) {
  return <View style={styles.cardBody}>{children}</View>;
}

function PhotoSection() {
  const { user, setUser } = useAuth();
  const { getInitials } = useGestionarCuenta();
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageUrl = selectedUri || getProfilePhotoUrl(user);

  const pickImage = async () => {
    try {
      const uri = await showImagePickerOptions();
      if (uri) setSelectedUri(uri);
    } catch (error) {
      console.error("Error al seleccionar imagen:", error);
      Alert.alert("Error", "No se pudo seleccionar la imagen");
    }
  };

  const upload = async () => {
    if (!selectedUri) return;
    setUploading(true);
    try {
      const uploaded = await filesService.uploadImage({
        uri: selectedUri,
        name: `profile-${Date.now()}.jpg`,
        type: "image/jpeg",
      });
      const updatedUser = await authService.updateProfilePhoto(uploaded.url, uploaded.filename);
      setUser(updatedUser);
      setSelectedUri(null);
      Alert.alert("Listo", "Foto de perfil actualizada correctamente");
    } catch (error: any) {
      console.error("Error al actualizar foto de perfil:", error);
      Alert.alert("Error", error.message || "No se pudo actualizar la foto de perfil");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SettingsCard title="Foto de perfil">
      <CardBody>
        <View style={styles.avatarRing}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.initials, { backgroundColor: palette.primary }]}>
              <Text className="text-3xl font-semibold" style={{ color: palette.primaryForeground }}>
                {getInitials()}
              </Text>
            </View>
          )}
        </View>
        <Button variant="outline" onPress={pickImage} disabled={uploading}>
          <Text>{selectedUri || imageUrl ? "Cambiar foto" : "Seleccionar foto"}</Text>
        </Button>
        {selectedUri ? (
          <View style={styles.actions}>
            <Button variant="ghost" onPress={() => setSelectedUri(null)} disabled={uploading}>
              <Text>Descartar</Text>
            </Button>
            <SaveButton label="Guardar foto" loading={uploading} disabled={false} onPress={upload} />
          </View>
        ) : null}
      </CardBody>
    </SettingsCard>
  );
}

function NameSection() {
  const { refreshUser } = useAuth();
  const { getFullName } = useGestionarCuenta();
  const currentName = getFullName();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const changed = Boolean(name.trim()) && name.trim() !== currentName;

  const save = async () => {
    setSaving(true);
    try {
      await authService.updateName(name.trim());
      await refreshUser();
      Alert.alert("Listo", "Nombre actualizado correctamente");
    } catch (error: any) {
      console.error("Error al actualizar nombre:", error);
      Alert.alert("Error", error.message || "No se pudo actualizar el nombre");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Nombre">
      <CardBody>
        <GlassInput
          label="Nombre completo"
          required
          requiredMessage="El nombre no puede estar vacío."
          placeholder="Ingresa tu nombre completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!saving}
        />
        <SaveButton label="Guardar nombre" loading={saving} disabled={!changed} onPress={save} />
      </CardBody>
    </SettingsCard>
  );
}

function PasswordSection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsOld = newPassword.length > 0 && newPassword === oldPassword;
  const valid = Boolean(oldPassword && newPassword && confirmPassword) && !tooShort && !mismatch && !sameAsOld;

  const save = async () => {
    setSaving(true);
    try {
      await authService.updatePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Listo", "Contraseña actualizada correctamente");
    } catch (error: any) {
      console.error("Error al actualizar contraseña:", error);
      const message = error.message?.includes("Invalid credentials") || error.message?.includes("invalid")
        ? "La contraseña actual es incorrecta"
        : error.message || "No se pudo actualizar la contraseña";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Contraseña">
      <CardBody>
        <GlassInput
          label="Contraseña actual"
          type="password"
          placeholder="Ingresa tu contraseña actual"
          value={oldPassword}
          onChangeText={setOldPassword}
          editable={!saving}
        />
        <GlassInput
          label="Nueva contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={newPassword}
          onChangeText={setNewPassword}
          editable={!saving}
          error={tooShort ? "Debe tener al menos 8 caracteres." : sameAsOld ? "Debe ser diferente a la actual." : undefined}
        />
        <GlassInput
          label="Confirmar nueva contraseña"
          type="password"
          placeholder="Repite la nueva contraseña"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!saving}
          error={mismatch ? "Las contraseñas no coinciden." : undefined}
        />
        <SaveButton label="Actualizar contraseña" loading={saving} disabled={!valid} onPress={save} />
      </CardBody>
    </SettingsCard>
  );
}

export default function EditarPerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <CollapsingHeaderScrollView
        title="Editar perfil"
        subtitle="Actualiza tu foto, nombre y contraseña."
        headerLeft={
          <GlassIconButton
            icon="ic:baseline-arrow-back-ios-new"
            accessibilityLabel="Regresar"
            onPress={() => router.back()}
            size={40}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        <View className="mx-auto w-full max-w-[672px]" style={{ gap: 20 }}>
          <PhotoSection />
          <NameSection />
          <PasswordSection />
        </View>
      </CollapsingHeaderScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  avatarRing: {
    alignSelf: "center",
    padding: 3,
    borderRadius: 60,
    backgroundColor: "rgba(152, 22, 70, 0.15)",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: "hidden",
  },
  initials: {
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
