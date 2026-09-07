import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService, ServiceInput } from "@/src/services/admin";
import { requestsService } from "@/src/services/requests";
import type {
  AdministrativeUnit,
  ProcedureService,
  ServiceType,
} from "@/src/types/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { useState } from "react";

type Section = "solicitudes" | "tramites" | "usuarios";
const EMPTY_SERVICE: ServiceInput = {
  unitId: "",
  code: "",
  type: "tramite",
  name: "",
  description: "",
  targetAudience: "",
  cost: "Gratuito",
  active: true,
  requirements: [],
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-medium">{label}</Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function UnitPicker({
  units,
  value,
  onChange,
}: {
  units: AdministrativeUnit[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="font-medium">Unidad administrativa</Text>
      {units.map((unit) => (
        <Pressable
          key={unit.id}
          onPress={() => onChange(unit.id)}
          className={`rounded-xl border p-3 ${value === unit.id ? "border-primary bg-primary/10" : "border-border"}`}
        >
          <Text
            className={value === unit.id ? "font-semibold text-primary" : ""}
          >
            {unit.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("solicitudes");
  const [serviceModal, setServiceModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceInput>(EMPTY_SERVICE);
  const [requirementsText, setRequirementsText] = useState("");
  const [configurationText, setConfigurationText] = useState("");
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    password: "",
    unitId: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const requests = useQuery({
    queryKey: ["admin", "requests", user?.unidadAdministrativaId],
    queryFn: requestsService.listAccessible,
    enabled:
      user?.role === "super_admin" ||
      user?.role === "enlace" ||
      user?.role === "gestor",
  });
  const units = useQuery({
    queryKey: ["admin", "units"],
    queryFn: adminService.listUnits,
    enabled: user?.role === "super_admin",
  });
  const services = useQuery({
    queryKey: ["admin", "services"],
    queryFn: adminService.listServices,
    enabled: user?.role === "super_admin",
  });

  const parseFields = () =>
    configurationText
      .split("\n")
      .map((line) => {
        const [key, label, placeholder] = line
          .split("|")
          .map((item) => item.trim());
        return { key, label, placeholder, required: true };
      })
      .filter((field) => field.key && field.label);
  const saveService = useMutation({
    mutationFn: () =>
      adminService.saveService({
        ...serviceForm,
        formConfig: { fields: parseFields() },
        requirements: requirementsText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "services"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setServiceModal(false);
      setMessage("Trámite guardado correctamente");
    },
    onError: (cause: Error) => setMessage(cause.message),
  });
  const inviteUser = useMutation({
    mutationFn: () =>
      adminService.createStaffUser({ ...invite, role: "enlace" }),
    onSuccess: () => {
      setUserModal(false);
      setInvite({ name: "", email: "", password: "", unitId: "" });
      setMessage("Usuario creado y relacionado con la unidad");
    },
    onError: (cause: Error) => setMessage(cause.message),
  });

  if (
    user?.role !== "super_admin" &&
    user?.role !== "enlace" &&
    user?.role !== "gestor"
  )
    return <Redirect href="/home" />;
  const isAdmin = user.role === "super_admin";
  const openNewService = () => {
    setServiceForm({ ...EMPTY_SERVICE, unitId: units.data?.[0]?.id || "" });
    setRequirementsText("");
    setConfigurationText("");
    setServiceModal(true);
    setMessage(null);
  };
  const openEditService = async (item: ProcedureService) => {
    const requirements = await adminService.listRequirements(item.id);
    setServiceForm({
      id: item.id,
      unitId: item.unitId,
      code: item.code,
      type: item.type,
      name: item.name,
      description: item.description,
      targetAudience: item.targetAudience,
      cost: item.cost,
      active: item.active,
      formConfig: item.formConfig,
      requirements: requirements.map((r) => r.name),
    });
    setRequirementsText(requirements.map((r) => r.name).join("\n"));
    setConfigurationText(
      (item.formConfig?.fields || [])
        .map(
          (field) => `${field.key}|${field.label}|${field.placeholder || ""}`,
        )
        .join("\n"),
    );
    setServiceModal(true);
    setMessage(null);
  };
  const validService =
    serviceForm.unitId &&
    serviceForm.code.trim() &&
    serviceForm.name.trim() &&
    serviceForm.description.trim() &&
    requirementsText.trim();
  const validInvite =
    invite.unitId &&
    invite.name.trim() &&
    invite.email.trim().endsWith("@tabasco.gob.mx") &&
    invite.password.length >= 8;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshes: Promise<unknown>[] = [requests.refetch()];
      if (isAdmin) refreshes.push(units.refetch(), services.refetch());
      await Promise.all(refreshes);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-6 pb-4 pt-14">
        <Text className="text-2xl font-bold">Administración</Text>
        <Text className="mt-1 text-muted-foreground">
          {isAdmin
            ? "Configuración general del sistema"
            : "Solicitudes de tu unidad"}
        </Text>
      </View>
      <View className="flex-row border-b border-border bg-card px-3">
        {(
          [
            "solicitudes",
            ...(isAdmin ? ["tramites", "usuarios"] : []),
          ] as Section[]
        ).map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setSection(item);
              setMessage(null);
            }}
            className={`flex-1 border-b-2 px-2 py-4 ${section === item ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={`text-center text-sm capitalize ${section === item ? "font-bold text-primary" : "text-muted-foreground"}`}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      {message ? (
        <View className="mx-5 mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3">
          <Text className="text-center text-sm text-primary">{message}</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#981646"
            colors={["#981646"]}
          />
        }
      >
        {section === "solicitudes" &&
          (requests.isLoading ? (
            <ActivityIndicator color="#981646" />
          ) : requests.data?.length ? (
            requests.data.map((item) => (
              <View
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row justify-between gap-2">
                  <Text className="flex-1 font-bold">{item.folio}</Text>
                  <Text className="text-xs font-semibold text-primary">
                    {item.status.replaceAll("_", " ")}
                  </Text>
                </View>
                <Text className="mt-2 text-sm text-muted-foreground">
                  {new Date(item.requestedAt).toLocaleString("es-MX")}
                </Text>
              </View>
            ))
          ) : (
            <Text className="py-12 text-center text-muted-foreground">
              No hay solicitudes registradas.
            </Text>
          ))}
        {section === "tramites" && (
          <>
            <Button onPress={openNewService}>
              <Text>Agregar trámite o servicio</Text>
            </Button>
            {services.isLoading ? (
              <ActivityIndicator color="#981646" />
            ) : (
              services.data?.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openEditService(item)}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <View className="flex-row justify-between">
                    <Text className="flex-1 font-bold">{item.name}</Text>
                    <Text
                      className={
                        item.active ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {item.active ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {item.code} · {item.type}
                  </Text>
                  <Text className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}
        {section === "usuarios" && (
          <>
            <Button
              onPress={() => {
                setInvite((current) => ({
                  ...current,
                  unitId: current.unitId || units.data?.[0]?.id || "",
                }));
                setUserModal(true);
                setMessage(null);
              }}
            >
              <Text>Dar de alta enlace</Text>
            </Button>
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className="font-bold">Acceso institucional</Text>
              <Text className="mt-2 text-sm text-muted-foreground">
                Los enlaces se crean con correo @tabasco.gob.mx, reciben el rol
                enlace y se agregan al equipo de su unidad administrativa.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <View className="border-t border-border p-4">
        <Button
          variant="outline"
          onPress={() => router.replace("/home" as any)}
        >
          <Text>Volver al inicio</Text>
        </Button>
      </View>

      <Modal
        visible={serviceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setServiceModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[92%] rounded-t-3xl bg-background p-6">
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text className="text-xl font-bold">
                {serviceForm.id ? "Editar" : "Nuevo"} trámite o servicio
              </Text>
              <Field
                label="Clave"
                value={serviceForm.code}
                onChangeText={(code) =>
                  setServiceForm({ ...serviceForm, code })
                }
                placeholder="Ej. PT-001"
              />
              <Field
                label="Nombre"
                value={serviceForm.name}
                onChangeText={(name) =>
                  setServiceForm({ ...serviceForm, name })
                }
              />
              <Field
                label="Descripción"
                value={serviceForm.description}
                onChangeText={(description) =>
                  setServiceForm({ ...serviceForm, description })
                }
              />
              <Field
                label="Población objetivo"
                value={serviceForm.targetAudience || ""}
                onChangeText={(targetAudience) =>
                  setServiceForm({ ...serviceForm, targetAudience })
                }
              />
              <Field
                label="Costo"
                value={serviceForm.cost || ""}
                onChangeText={(cost) =>
                  setServiceForm({ ...serviceForm, cost })
                }
              />
              <View className="gap-2">
                <Text className="font-medium">Tipo</Text>
                <View className="flex-row gap-2">
                  {(["tramite", "servicio", "programa"] as ServiceType[]).map(
                    (type) => (
                      <Pressable
                        key={type}
                        onPress={() => setServiceForm({ ...serviceForm, type })}
                        className={`flex-1 rounded-xl border p-3 ${serviceForm.type === type ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <Text className="text-center capitalize">{type}</Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
              <UnitPicker
                units={units.data || []}
                value={serviceForm.unitId}
                onChange={(unitId) =>
                  setServiceForm({ ...serviceForm, unitId })
                }
              />
              <Field
                label="Requisitos (uno por línea)"
                value={requirementsText}
                onChangeText={setRequirementsText}
                placeholder={"INE vigente\nCURP\nComprobante de domicilio"}
              />
              <Field
                label="Campos particulares (clave|etiqueta|ayuda)"
                value={configurationText}
                onChangeText={setConfigurationText}
                placeholder={
                  "nombreNegocio|Nombre del negocio|Ej. Hotel Paraíso\nmotivo|Motivo de la solicitud|Describe qué necesitas"
                }
              />
              <View className="flex-row items-center justify-between">
                <Text className="font-medium">Disponible para solicitudes</Text>
                <Switch
                  value={serviceForm.active}
                  onValueChange={(active) =>
                    setServiceForm({ ...serviceForm, active })
                  }
                />
              </View>
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setServiceModal(false)}
                >
                  <Text>Cancelar</Text>
                </Button>
                <Button
                  className="flex-1"
                  disabled={!validService || saveService.isPending}
                  onPress={() => saveService.mutate()}
                >
                  <Text>
                    {saveService.isPending ? "Guardando..." : "Guardar"}
                  </Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={userModal}
        transparent
        animationType="slide"
        onRequestClose={() => setUserModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[92%] rounded-t-3xl bg-background p-6">
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text className="text-xl font-bold">Dar de alta enlace</Text>
              <Field
                label="Nombre completo"
                value={invite.name}
                onChangeText={(name) => setInvite({ ...invite, name })}
              />
              <Field
                label="Correo institucional"
                value={invite.email}
                onChangeText={(email) =>
                  setInvite({ ...invite, email: email.toLowerCase() })
                }
                placeholder="usuario@tabasco.gob.mx"
              />
              <Field
                label="Contraseña temporal"
                value={invite.password}
                onChangeText={(password) => setInvite({ ...invite, password })}
                secureTextEntry
              />
              <UnitPicker
                units={units.data || []}
                value={invite.unitId}
                onChange={(unitId) => setInvite({ ...invite, unitId })}
              />
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setUserModal(false)}
                >
                  <Text>Cancelar</Text>
                </Button>
                <Button
                  className="flex-1"
                  disabled={!validInvite || inviteUser.isPending}
                  onPress={() => inviteUser.mutate()}
                >
                  <Text>
                    {inviteUser.isPending ? "Creando..." : "Crear usuario"}
                  </Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
