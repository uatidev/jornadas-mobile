import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import { UserData } from "@/src/services/auth";
import { filesService } from "@/src/services/files";
import { Image, View } from "react-native";

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

const getRoleLabel = (role: string) => ROLE_LABELS[role] || role;

export function ProfileCard({ user, getInitials }: ProfileCardProps) {
  const { colorScheme } = useTheme();
  const cardForegroundColor = THEME[colorScheme].cardForeground;
  const mutedForegroundColor = THEME[colorScheme].mutedForeground;

  const fullName = [user?.nombre, user?.primerApellido, user?.segundoApellido]
    .filter(Boolean)
    .join(" ");

  // Generar URL de la imagen construyendo la URL completa manualmente
  const imageUrl = (() => {
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
  })();

  return (
    <View
      className="flex-row items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card px-4 py-5"
      style={{
        borderRadius: 16,
      }}
    >
      {imageUrl ? (
        <View className="size-16 rounded-full overflow-hidden bg-primary items-center justify-center">
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 64, height: 64 }}
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
        </View>
      ) : (
        <Avatar
          alt={`${user?.nombre || "Usuario"}'s avatar`}
          className="size-16"
        >
          <AvatarFallback className="bg-primary">
            <Text className="text-primary-foreground text-xl font-semibold">
              {getInitials()}
            </Text>
          </AvatarFallback>
        </Avatar>
      )}
      <View className="flex-1">
        <Text
          className="text-lg font-semibold"
          style={{ color: cardForegroundColor }}
        >
          {fullName || "Usuario"}
        </Text>
        {user?.email && (
          <Text
            className="text-sm mt-1"
            style={{ color: mutedForegroundColor }}
          >
            {user.email}
          </Text>
        )}
        {(user?.labels && user.labels.length > 0) ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {user.labels.map((label, index) => (
              <View
                key={index}
                className="px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    colorScheme === "dark"
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.05)",
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: mutedForegroundColor }}
                >
                  {getRoleLabel(label)}
                </Text>
              </View>
            ))}
          </View>
        ) : user?.role ? (
          <View className="mt-2">
            <View
              className="px-2 py-1 rounded-full self-start"
              style={{
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: mutedForegroundColor }}
              >
                {getRoleLabel(user.role)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}


