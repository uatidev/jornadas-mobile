import { isCorsError, sifFetch } from "@/src/utils/sifApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  APPWRITE_CONFIG,
  getAppwriteAccount,
  getAppwriteDatabases,
  ID,
  Models,
} from "./appwrite";

export interface UserData {
  id: string;
  email: string;
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista" | "solicitante";
  unidadAdministrativaId?: string;
  labels?: string[]; // Labels de Appwrite
  profilePhoto?: string;
  profilePhotoFileId?: string; // ID del archivo en Appwrite Storage
}

export interface LoginResponse {
  access_token: string;
  user: UserData;
  sifAccessToken?: string; // Token del SIF para usar en los endpoints
}

const USER_KEY = "auth_user";
const SIF_TOKEN_KEY = "sif_access_token";
const SIF_REFRESH_TOKEN_KEY = "sif_refresh_token";
const SIF_TOKEN_EXPIRY_KEY = "sif_token_expiry";

const SIF_BASE_URL = "https://sif.tabasco.gob.mx";
const SIF_REFRESH_ENDPOINT = `${SIF_BASE_URL}/user/api/token/refresh/`;

const mapAppwriteUserToUser = (
  appwriteUser: Models.User<Models.Preferences>,
): UserData => {
  const nameParts = appwriteUser.name?.split(" ") || [];
  const nombre = nameParts[0] || "";
  const primerApellido = nameParts[1] || "";
  const segundoApellido = nameParts.slice(2).join(" ") || undefined;

  // Obtener la foto de perfil desde las preferencias
  const profilePhoto = (appwriteUser.prefs as any)?.profilePhoto as
    | string
    | undefined;
  const profilePhotoFileId = (appwriteUser.prefs as any)?.profilePhotoFileId as
    | string
    | undefined;

  // Obtener los labels del usuario (Appwrite labels)
  const labels = (appwriteUser.labels as string[]) || [];

  const role: UserData["role"] = labels.includes("superadmin")
    ? "super_admin"
    : labels.includes("secretaria")
      ? "secretaria"
    : labels.includes("capturistasecretaria")
      ? "capturista_secretaria"
    : labels.includes("gestor")
      ? "gestor"
      : labels.includes("enlace")
        ? "enlace"
        : labels.includes("capturista")
          ? "capturista"
          : "solicitante";

  console.log("mapAppwriteUserToUser - prefs:", appwriteUser.prefs);
  console.log("mapAppwriteUserToUser - profilePhoto:", profilePhoto);
  console.log(
    "mapAppwriteUserToUser - profilePhotoFileId:",
    profilePhotoFileId,
  );
  console.log("mapAppwriteUserToUser - labels:", labels);

  return {
    id: appwriteUser.$id,
    email: appwriteUser.email,
    nombre,
    primerApellido,
    segundoApellido,
    role,
    labels,
    profilePhoto,
    profilePhotoFileId,
  };
};

const enrichUserWithProfile = async (userData: UserData): Promise<UserData> => {
  try {
    const profile: any = await getAppwriteDatabases().getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.COLLECTIONS.USUARIOS_PERFIL,
      userData.id,
    );
    return {
      ...userData,
      nombre: userData.nombre || profile.nombre,
      role: profile.rolSistema || profile.rol || userData.role,
      unidadAdministrativaId: profile.unidadAdministrativaId || undefined,
    };
  } catch {
    return userData;
  }
};

const setUser = async (user: UserData): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Error setting user:", error);
  }
};

const mapSifUserToUser = (sifUser: any): UserData => {
  const nameParts = sifUser.full_name?.split(" ") || [];
  const nombre = nameParts[0] || "";
  const primerApellido = nameParts[1] || "";
  const segundoApellido = nameParts.slice(2).join(" ") || undefined;

  return {
    id: sifUser.id?.toString() || "",
    email: sifUser.email || "",
    nombre,
    primerApellido,
    segundoApellido,
    role: sifUser.is_superuser
      ? "super_admin"
      : sifUser.is_staff
        ? "enlace"
        : "solicitante",
  };
};

const SIF_LOGIN_ENDPOINT = `${SIF_BASE_URL}/user/api/login/`;

const loginSIF = async (
  email: string,
  password: string,
): Promise<{ access: string; refresh: string; user: any }> => {
  try {
    const response = await sifFetch(SIF_LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Error en login SIF: ${response.status}`,
      );
    }

    const data = await response.json();
    return {
      access: data.tokens.access,
      refresh: data.tokens.refresh,
      user: data.user,
    };
  } catch (error: unknown) {
    console.error("Error en login SIF:", error);

    // Si es un error de CORS, proporcionar mensaje más útil
    if (isCorsError(error)) {
      throw error; // El error ya tiene un mensaje mejorado
    }

    throw error;
  }
};

const setSifTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(SIF_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(SIF_REFRESH_TOKEN_KEY, refreshToken);
    // Guardar timestamp de expiración (1 hora desde ahora, menos 5 minutos de margen)
    const expiryTime = Date.now() + 55 * 60 * 1000; // 55 minutos
    await AsyncStorage.setItem(SIF_TOKEN_EXPIRY_KEY, expiryTime.toString());
  } catch (error) {
    console.error("Error guardando tokens SIF:", error);
  }
};

const getSifRefreshToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(SIF_REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Error obteniendo refresh token SIF:", error);
    return null;
  }
};

export const getSifAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(SIF_TOKEN_KEY);
  } catch (error) {
    console.error("Error obteniendo token SIF:", error);
    return null;
  }
};

/**
 * Refresca el token de acceso usando el refresh token
 * Endpoint: POST /user/api/token/refresh/
 * Body: { refresh: string }
 * Response: { access: string, refresh?: string }
 */
export const refreshSifToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await getSifRefreshToken();
    if (!refreshToken) {
      console.error("No hay refresh token disponible");
      return null;
    }

    const response = await sifFetch(SIF_REFRESH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error refrescando token:", errorData);
      // Si el refresh token también expiró, limpiar todo
      await logout();
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access || data.tokens?.access;
    const newRefreshToken =
      data.refresh || data.tokens?.refresh || refreshToken;

    if (newAccessToken) {
      await setSifTokens(newAccessToken, newRefreshToken);
      console.log("Token refrescado exitosamente");
      return newAccessToken;
    }

    return null;
  } catch (error: unknown) {
    console.error("Error refrescando token SIF:", error);
    // Si es un error de CORS, no hacer logout (probablemente es desarrollo web)
    if (!isCorsError(error)) {
      await logout();
    }
    return null;
  }
};

/**
 * Obtiene el token de acceso, refrescándolo si es necesario
 */
export const getValidSifAccessToken = async (): Promise<string | null> => {
  try {
    // Verificar si el token está por expirar
    const expiryStr = await AsyncStorage.getItem(SIF_TOKEN_EXPIRY_KEY);
    const now = Date.now();

    if (expiryStr) {
      const expiryTime = parseInt(expiryStr, 10);
      // Si queda menos de 5 minutos o ya expiró, refrescar
      if (now >= expiryTime) {
        console.log("Token por expirar o expirado, refrescando...");
        const newToken = await refreshSifToken();
        if (newToken) {
          return newToken;
        }
      }
    }

    // Si no necesita refrescar, devolver el token actual
    return await getSifAccessToken();
  } catch (error) {
    console.error("Error obteniendo token válido:", error);
    return null;
  }
};

export const login = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  // Login con Appwrite (habilitado)
  let userData: UserData | null = null;
  let accessToken = "";
  let sifAccessToken: string | undefined;

  // Intentar login en Appwrite
  try {
    const account = getAppwriteAccount();
    await account.createEmailPasswordSession(email, password);
    const user = await account.get();
    userData = await enrichUserWithProfile(mapAppwriteUserToUser(user));
    accessToken = user.$id;
  } catch (appwriteError) {
    console.error("Error en login Appwrite:", appwriteError);
    const errorMessage =
      appwriteError instanceof Error
        ? appwriteError.message
        : "Error al iniciar sesión";
    throw new Error(errorMessage);
  }

  // TEMPORALMENTE DESACTIVADO: Login con SIF
  // try {
  //   const sifResult = await loginSIF(email, password);
  //   await setSifTokens(sifResult.access, sifResult.refresh);
  //   sifAccessToken = sifResult.access;
  //   userData = mapSifUserToUser(sifResult.user);
  //   accessToken = sifResult.access;
  // } catch (sifError) {
  //   console.log("Login en SIF falló:", sifError);
  //   const errorMessage =
  //     sifError instanceof Error ? sifError.message : "Error al iniciar sesión";
  //   throw new Error(errorMessage);
  // }

  // Guardar y retornar
  if (userData) {
    await setUser(userData);
    return {
      access_token: accessToken,
      user: userData,
      sifAccessToken,
    };
  }

  throw new Error("Error al iniciar sesión");
};

export const register = async (
  email: string,
  password: string,
  nombre: string = "",
  primerApellido: string = "",
  segundoApellido?: string,
): Promise<LoginResponse> => {
  let accountCreated = false;
  try {
    const account = getAppwriteAccount();

    // Si no se proporciona nombre, usar la parte antes del @ del email
    const defaultName = nombre || email.split("@")[0] || "Usuario";
    const fullName =
      `${defaultName} ${primerApellido} ${segundoApellido || ""}`.trim() ||
      defaultName;

    console.log("📝 Creando cuenta en Appwrite...");
    await account.create(ID.unique(), email, password, fullName);
    accountCreated = true;
    console.log("✅ Cuenta creada exitosamente");

    // Pequeño delay para asegurar que Appwrite procese la cuenta
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("🔐 Creando sesión...");
    let sessionCreated = false;
    try {
      await account.createEmailPasswordSession(email, password);
      sessionCreated = true;
      console.log("✅ Sesión creada exitosamente");
    } catch (sessionError: any) {
      console.error(
        "⚠️ Error al crear sesión (pero la cuenta fue creada):",
        sessionError,
      );
      console.error("Detalles del error de sesión:", {
        message: sessionError?.message,
        code: sessionError?.code,
        type: sessionError?.type,
      });

      // Si es un error de red, intentar una vez más después de un delay
      if (
        sessionError?.message?.includes("network") ||
        sessionError?.message?.includes("Network") ||
        sessionError?.message?.includes("failed")
      ) {
        console.log(
          "🔄 Error de red detectado, reintentando después de 1 segundo...",
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          await account.createEmailPasswordSession(email, password);
          sessionCreated = true;
          console.log("✅ Sesión creada en el segundo intento");
        } catch (retryError: any) {
          console.error("❌ Error persistente al crear sesión:", retryError);
          // Si la cuenta se creó pero la sesión falla, lanzar error específico
          throw new Error(
            "REGISTRO_EXITOSO_SIN_SESION: La cuenta fue creada exitosamente, pero no se pudo iniciar sesión automáticamente debido a un problema de conexión. Por favor intenta iniciar sesión manualmente.",
          );
        }
      } else {
        // Para otros errores, lanzar el error original
        throw sessionError;
      }
    }

    // Solo intentar obtener el usuario si la sesión se creó exitosamente
    if (!sessionCreated) {
      const nameParts = fullName.split(" ");
      const userData: UserData = {
        id: "pending",
        email: email,
        nombre: nameParts[0] || defaultName,
        primerApellido: nameParts[1] || "",
        segundoApellido: nameParts.slice(2).join(" ") || undefined,
        role: "solicitante",
      };
      return {
        access_token: "pending",
        user: userData,
      };
    }

    console.log("👤 Obteniendo información del usuario...");
    let user;
    try {
      user = await account.get();
      console.log("✅ Usuario obtenido:", user.$id);
    } catch (getUserError: any) {
      console.error("⚠️ Error al obtener usuario:", getUserError);
      // Si no podemos obtener el usuario pero la sesión existe, crear UserData básico
      const nameParts = fullName.split(" ");
      const userData: UserData = {
        id: "pending",
        email: email,
        nombre: nameParts[0] || defaultName,
        primerApellido: nameParts[1] || "",
        segundoApellido: nameParts.slice(2).join(" ") || undefined,
        role: "solicitante",
      };
      await setUser(userData);
      return {
        access_token: "pending",
        user: userData,
      };
    }

    // Extraer nombre y apellidos del fullName para UserData
    const nameParts = fullName.split(" ");
    const userNombre = nameParts[0] || defaultName;
    const userPrimerApellido = nameParts[1] || "";
    const userSegundoApellido = nameParts.slice(2).join(" ") || undefined;

    const userData: UserData = {
      id: user.$id,
      email: user.email,
      nombre: userNombre,
      primerApellido: userPrimerApellido,
      segundoApellido: userSegundoApellido,
      role: "solicitante",
    };

    await setUser(userData);
    console.log("✅ Registro completado exitosamente");

    return {
      access_token: user.$id,
      user: userData,
    };
  } catch (error: any) {
    console.error("❌ Error completo en registro:", {
      message: error?.message,
      code: error?.code,
      type: error?.type,
      response: error?.response,
      stack: error?.stack,
    });

    // Si la cuenta fue creada pero falló algo después, lanzar error especial
    if (accountCreated) {
      // Crear un error especial que indique que el registro fue exitoso
      const successError = new Error(
        "REGISTRO_EXITOSO_SIN_SESION: La cuenta fue creada exitosamente, pero hubo un problema al iniciar sesión automáticamente. Por favor intenta iniciar sesión manualmente.",
      );
      (successError as any).isRegistrationSuccess = true;
      throw successError;
    }

    let errorMessage = error?.message || "Error al registrar usuario";

    // Mensajes de error más específicos
    if (errorMessage.includes("already exists") || error?.code === 409) {
      errorMessage =
        "Este correo electrónico ya está registrado. Por favor intenta iniciar sesión.";
    } else if (
      errorMessage.includes("network") ||
      errorMessage.includes("Network")
    ) {
      errorMessage =
        "Error de conexión. Por favor verifica tu conexión a internet e intenta nuevamente.";
    }

    throw new Error(errorMessage);
  }
};

export const getUser = async (): Promise<UserData | null> => {
  // Obtener usuario de Appwrite
  try {
    const account = getAppwriteAccount();
    const user = await account.get();
    const userData = await enrichUserWithProfile(mapAppwriteUserToUser(user));
    await setUser(userData); // Guardar localmente también
    return userData;
  } catch (appwriteError) {
    console.log(
      "Error obteniendo usuario de Appwrite, intentando local:",
      appwriteError,
    );
    // Fallback a datos locales si Appwrite falla
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      if (!userStr) return null;
      return JSON.parse(userStr) as UserData;
    } catch (storageError) {
      console.error("Error getting user:", storageError);
      return null;
    }
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  // Verificar autenticación con Appwrite
  try {
    const account = getAppwriteAccount();
    const user = await account.get();
    return !!user && !!user.$id;
  } catch (appwriteError) {
    console.log("Error verificando autenticación Appwrite:", appwriteError);
    // Fallback: verificar si hay usuario guardado localmente
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      return !!userStr;
    } catch {
      return false;
    }
  }
};

export const logout = async (): Promise<void> => {
  try {
    // Cerrar sesión en Appwrite
    try {
      const account = getAppwriteAccount();
      await account.deleteSession("current");
    } catch (appwriteError) {
      console.log("Error cerrando sesión Appwrite:", appwriteError);
    }

    // Limpiar todos los datos de autenticación locales
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(SIF_TOKEN_KEY);
    await AsyncStorage.removeItem(SIF_REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(SIF_TOKEN_EXPIRY_KEY);
  } catch (error) {
    console.error("Error en logout:", error);
  }
};

export const forgotPassword = async (email: string): Promise<void> => {
  try {
    const account = getAppwriteAccount();
    // URL de la aplicación web para reset de contraseña
    // Appwrite automáticamente agregará los query params userId y secret
    const redirectUrl = "https://jornadas-turismo.web.app/";

    console.log("🔐 Solicitando recuperación de contraseña");
    console.log("📧 Email:", email);
    console.log("🔗 URL de redirección:", redirectUrl);

    await account.createRecovery(email, redirectUrl);

    console.log("✅ Solicitud de recuperación enviada exitosamente");
  } catch (error: any) {
    console.error("❌ Error completo en recuperación de contraseña:", {
      message: error?.message,
      code: error?.code,
      type: error?.type,
      response: error?.response,
      stack: error?.stack,
    });

    // Extraer mensaje de error más específico
    let errorMessage =
      error?.message || "Error al enviar el correo de recuperación";

    // Si el error viene de AppwriteException, puede tener más información
    if (error?.response) {
      try {
        const errorData =
          typeof error.response === "string"
            ? JSON.parse(error.response)
            : error.response;
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Si no se puede parsear, usar el mensaje original
      }
    }

    // Manejar error específico de SMTP deshabilitado
    if (
      errorMessage.includes("SMTP Disabled") ||
      errorMessage.includes("SMTP disabled") ||
      error?.code === 503 ||
      error?.type === "general_smtp_disabled"
    ) {
      throw new Error(
        "El servicio de correo electrónico no está disponible. Por favor verifica la configuración SMTP en el servidor o contacta al administrador.",
      );
    }

    throw new Error(
      errorMessage ||
        "Error al enviar el correo de recuperación. Por favor intenta nuevamente.",
    );
  }
};

export const resetPassword = async (
  userId: string,
  secret: string,
  password: string,
): Promise<void> => {
  try {
    const account = getAppwriteAccount();
    await account.updateRecovery(userId, secret, password);
  } catch (error: unknown) {
    console.error("Error al restablecer contraseña:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error al restablecer la contraseña";
    throw new Error(errorMessage);
  }
};

export const updateName = async (name: string): Promise<void> => {
  try {
    const account = getAppwriteAccount();
    await account.updateName(name);
    // Actualizar el usuario en el estado local
    const user = await account.get();
    const userData = mapAppwriteUserToUser(user);
    await setUser(userData);
  } catch (error: unknown) {
    console.error("Error al actualizar nombre:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error al actualizar el nombre";
    throw new Error(errorMessage);
  }
};

export const updatePassword = async (
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  try {
    const account = getAppwriteAccount();
    await account.updatePassword(newPassword, oldPassword);
  } catch (error: unknown) {
    console.error("Error al actualizar contraseña:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error al actualizar la contraseña";
    throw new Error(errorMessage);
  }
};

export const updateProfilePhoto = async (
  photoUrl: string,
  fileId?: string,
): Promise<UserData> => {
  try {
    const account = getAppwriteAccount();
    // Appwrite no tiene un método directo para actualizar la foto de perfil
    // Usamos updatePrefs para guardar la URL y el fileId de la foto
    const prefsToUpdate: any = { profilePhoto: photoUrl };
    if (fileId) {
      prefsToUpdate.profilePhotoFileId = fileId;
    }
    await account.updatePrefs(prefsToUpdate);

    // Pequeño delay para asegurar que Appwrite procese el cambio
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Obtener el usuario actualizado con las nuevas preferencias
    const user = await account.get();
    console.log("updateProfilePhoto - user.prefs:", user.prefs);
    const userData = mapAppwriteUserToUser(user);
    console.log(
      "updateProfilePhoto - userData.profilePhoto:",
      userData.profilePhoto,
    );
    console.log(
      "updateProfilePhoto - userData.profilePhotoFileId:",
      userData.profilePhotoFileId,
    );

    // Actualizar el estado local
    await setUser(userData);

    return userData;
  } catch (error: unknown) {
    console.error("Error al actualizar foto de perfil:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error al actualizar la foto de perfil";
    throw new Error(errorMessage);
  }
};

export const authService = {
  login,
  register,
  getUser,
  isAuthenticated,
  logout,
  forgotPassword,
  resetPassword,
  updateName,
  updatePassword,
  updateProfilePhoto,
  getSifAccessToken,
  getValidSifAccessToken,
  refreshSifToken,
};
