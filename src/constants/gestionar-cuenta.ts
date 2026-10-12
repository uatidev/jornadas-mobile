import { SettingsGroup } from "@/src/types/gestionar-cuenta";

export const createSettingsGroups = (
  handlers: {
    handleEditProfile: () => void;
    handleEnable2FA: () => void;
    handlePrivacyPolicy: () => void;
    handleTermsAndConditions: () => void;
    handleEULA: () => void;
    handleDeleteAccount: () => void;
  }
): SettingsGroup[] => [
  {
    id: "profile",
    title: "Perfil",
    options: [
      {
        id: "edit-profile",
        title: "Editar perfil",
        description: "Foto, nombre y contraseña",
        iconName: "material-symbols:account-circle-outline",
        onPress: handlers.handleEditProfile,
      },
    ],
  },
  {
    id: "security",
    title: "Seguridad",
    options: [
      {
        id: "2fa",
        title: "Autenticación en 2 pasos",
        description: "Habilita la verificación en dos pasos",
        iconName: "material-symbols:shield-lock-outline",
        onPress: handlers.handleEnable2FA,
      },
    ],
  },
  {
    id: "legal",
    title: "Legal",
    options: [
      {
        id: "privacy",
        title: "Aviso de privacidad",
        description: "Consulta nuestro aviso de privacidad",
        iconName: "material-symbols:privacy-tip-outline",
        onPress: handlers.handlePrivacyPolicy,
      },
      {
        id: "terms",
        title: "Términos y condiciones",
        description: "Consulta nuestros términos y condiciones",
        iconName: "material-symbols:description-outline",
        onPress: handlers.handleTermsAndConditions,
      },
      {
        id: "eula",
        title: "EULA",
        description: "End User License Agreement",
        iconName: "material-symbols:article-outline",
        onPress: handlers.handleEULA,
      },
    ],
  },
  {
    id: "account",
    title: "Cuenta",
    options: [
      {
        id: "delete",
        title: "Eliminar cuenta",
        description: "Elimina tu cuenta permanentemente",
        iconName: "material-symbols:delete-outline",
        onPress: handlers.handleDeleteAccount,
        variant: "destructive",
      },
    ],
  },
];

