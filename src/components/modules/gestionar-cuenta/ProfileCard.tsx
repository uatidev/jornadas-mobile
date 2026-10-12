import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import { UserData } from "@/src/services/auth";
import { filesService } from "@/src/services/files";
import { Image, StyleSheet, View } from "react-native";
import { GlassSurface, liquidGlassEnabled } from "@/src/components/common/GlassSurface";

interface ProfileCardProps {
  user: UserData | null;
  getInitials: () => string;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrador",
  super_admin: "Superadministrador",
  secretaria: "Secretaria",
  capturistasecretaria: "Representante de la Titular",
  capturista_secretaria: "Representante de la Titular",
  enlace: "Enlace de canalización",
  gestor: "Gestor",
  capturista: "Capturista",
  solicitante: "Solicitante",
};

// Constante fuera del componente: un objeto nuevo en cada render hace que el
// Liquid Glass repita su animación de entrada.
const GLASS_APPEAR = { style: "regular", animate: true } as const;

const getRoleLabel = (role: string) => ROLE_LABELS[role] || role;

/** URL de la foto de perfil del usuario (o null si no tiene). */
export function getProfilePhotoUrl(user: UserData | null): string | null {
  let fileId: string | null = null;

  // Prioridad 1: Si tenemos el fileId directamente
  if (user?.profilePhotoFileId) {
    fileId = user.profilePhotoFileId;
  }
  // Prioridad 2: Si hay profilePhoto, extraer el fileId de la URL
  else if (user?.profilePhoto) {
    // Extraer el fileId de la URL (formato: /storage/buckets/.../files/FILE_ID/view?...)
    const fileIdMatch = user.profilePhoto.match(/\/files\/([a-zA-Z0-9]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      fileId = fileIdMatch[1];
    }
    // Si la URL ya es completa (empieza con http/https), usarla directamente
    else if (user.profilePhoto.startsWith("http://") || user.profilePhoto.startsWith("https://")) {
      return user.profilePhoto;
    }
  }

  // Si tenemos un fileId, construir la URL completa
  if (fileId) {
    return filesService.getImageUrl(fileId, "images");
  }

  return null;
}

export function ProfileCard({ user, getInitials }: ProfileCardProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];

  const fullName = [user?.nombre, user?.primerApellido, user?.segundoApellido]
    .filter(Boolean)
    .join(" ");

  const imageUrl = getProfilePhotoUrl(user);

  const roles = user?.labels?.length ? user.labels : user?.role ? [user.role] : [];

  return (
    <GlassSurface
      colorScheme={colorScheme}
      style={styles.card}
      glassEffectStyle={liquidGlassEnabled ? GLASS_APPEAR : "regular"}
    >
      <View style={styles.avatarRing}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatar}
            resizeMode="cover"
            onError={(error) => {
              // Evitar error de estructura cíclica en JSON.stringify
              const errorInfo = {
                errorType: error?.nativeEvent?.error || "Unknown error",
                uri: imageUrl,
                profilePhoto: user?.profilePhoto,
                fileId: user?.profilePhotoFileId,
              };
              console.error("Error cargando imagen de perfil:", errorInfo);
            }}
          />
        ) : (
          <View style={[styles.avatar, styles.initials, { backgroundColor: palette.primary }]}>
            <Text className="text-2xl font-semibold" style={{ color: palette.primaryForeground }}>
              {getInitials()}
            </Text>
          </View>
        )}
      </View>

      <Text
        numberOfLines={2}
        className="mt-3 text-center text-xl font-bold"
        style={{ color: palette.foreground }}
      >
        {fullName || "Usuario"}
      </Text>
      {user?.email ? (
        <Text
          numberOfLines={1}
          className="mt-0.5 text-center text-sm"
          style={{ color: palette.mutedForeground }}
        >
          {user.email}
        </Text>
      ) : null}
      {roles.length ? (
        <View className="mt-3 flex-row flex-wrap justify-center gap-2">
          {roles.map((role) => (
            <View key={role} className="rounded-full bg-primary/10 px-3 py-1">
              <Text className="text-xs font-semibold text-primary">{getRoleLabel(role)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  avatarRing: {
    alignSelf: "center",
    padding: 3,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
  },
  initials: {
    alignItems: "center",
    justifyContent: "center",
  },
});
