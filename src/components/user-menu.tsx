import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Icon } from "@/src/components/ui/icon";
import { THEME } from "@/src/components/ui/lib/theme";
import { cn } from "@/src/components/ui/lib/utils";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import { UserData } from "@/src/services/auth";
import { catalogService } from "@/src/services/catalog";
import { filesService } from "@/src/services/files";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LogOutIcon, SettingsIcon } from "lucide-react-native";
import * as React from "react";
import { useMemo } from "react";
import { Modal, Platform, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UserMenuProps {
  user: UserData | null;
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = THEME[colorScheme].background;
  const borderColor = THEME[colorScheme].border;
  const units = useQuery({
    queryKey: ["catalog", "units"],
    queryFn: catalogService.listUnits,
    enabled: user?.role !== "capturista" && Boolean(user?.unidadAdministrativaId),
  });
  const unit = units.data?.find(
    (item) => item.id === user?.unidadAdministrativaId,
  );
  const roleLabels: Record<UserData["role"], string> = {
    super_admin: "Superadministrador",
    secretaria: "Secretaria",
    capturista_secretaria: "Representante de la Titular",
    enlace: "Enlace",
    gestor: "Gestor",
    capturista: "Capturista",
    solicitante: "Solicitante",
  };

  const UserMenuContent = () => (
    <View className="border-border gap-3 border-b p-3">
      <View className="flex-row items-center gap-3">
        <UserAvatar className="size-10" user={user} />
        <View className="flex-1">
          <Text className="font-medium leading-5">
            {user?.nombre || "Usuario"}
          </Text>
          {user?.email ? (
            <Text className="text-muted-foreground text-sm font-normal leading-4">
              {user.email}
            </Text>
          ) : null}
          {user?.role ? (
            <Text className="mt-1 text-xs font-semibold text-primary">
              {roleLabels[user.role]}
            </Text>
          ) : null}
          {user?.unidadAdministrativaId && user.role !== "capturista" ? (
            <Text
              className="mt-0.5 text-xs text-muted-foreground"
              numberOfLines={2}
            >
              {units.isLoading
                ? "Cargando unidad administrativa…"
                : unit?.name || user.unidadAdministrativaId}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row flex-wrap gap-3 py-0.5">
        <Button
          variant="outline"
          size="sm"
          onPress={() => {
            setIsOpen(false);
            router.push("/(protected)/gestionar-cuenta");
          }}
        >
          <Icon
            as={SettingsIcon}
            className="size-4"
            color={THEME[colorScheme].foreground}
          />
          <Text>Configuración</Text>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onPress={() => {
            setIsOpen(false);
            onLogout();
          }}
        >
          <Icon
            as={LogOutIcon}
            className="size-4"
            color={THEME[colorScheme].destructive}
          />
          <Text style={{ color: THEME[colorScheme].destructive }}>
            Cerrar Sesión
          </Text>
        </Button>
      </View>
    </View>
  );

  // En móvil usar Modal, en web usar DropdownMenu
  if (Platform.OS !== "web") {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onPress={() => setIsOpen(true)}
        >
          <UserAvatar user={user} />
        </Button>
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
            <View
              className="flex-1 items-end justify-start"
              style={{
                paddingTop: insets.top,
                paddingRight: 16,
                paddingLeft: 16,
              }}
            >
              <TouchableWithoutFeedback>
                <View
                  className="bg-popover border-border rounded-md border shadow-lg"
                  style={{
                    width: 320,
                    marginTop: 60,
                    backgroundColor,
                    borderColor,
                  }}
                >
                  <UserMenuContent />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserAvatar user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <UserMenuContent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserAvatar({
  className,
  user,
  ...props
}: Omit<React.ComponentProps<typeof Avatar>, "alt"> & {
  user: UserData | null;
}) {
  // Obtener iniciales del usuario
  const getInitials = () => {
    if (!user?.nombre) return "U";
    const names = user.nombre.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.nombre[0].toUpperCase();
  };

  // Generar URL de la imagen de perfil
  const imageUrl = useMemo(() => {
    let fileId: string | null = null;

    // Prioridad 1: Si tenemos el fileId directamente
    if (user?.profilePhotoFileId) {
      fileId = user.profilePhotoFileId;
    }
    // Prioridad 2: Si hay profilePhoto, extraer el fileId de la URL
    else if (user?.profilePhoto) {
      const fileIdMatch = user.profilePhoto.match(/\/files\/([a-zA-Z0-9]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        fileId = fileIdMatch[1];
      }
      // Si la URL ya es completa (empieza con http/https), usarla directamente
      else if (
        user.profilePhoto.startsWith("http://") ||
        user.profilePhoto.startsWith("https://")
      ) {
        return user.profilePhoto;
      }
    }

    // Si tenemos un fileId, construir la URL completa
    if (fileId) {
      return filesService.getImageUrl(fileId, "images");
    }

    return null;
  }, [user?.profilePhoto, user?.profilePhotoFileId]);

  return (
    <Avatar
      alt={`${user?.nombre || "Usuario"}'s avatar`}
      className={cn("size-8", className)}
      {...props}
    >
      {imageUrl && <AvatarImage source={{ uri: imageUrl }} />}
      <AvatarFallback className="bg-primary">
        <Text className="text-primary-foreground text-sm font-semibold">
          {getInitials()}
        </Text>
      </AvatarFallback>
    </Avatar>
  );
}
