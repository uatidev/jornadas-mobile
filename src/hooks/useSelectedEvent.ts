import { useSyncExternalStore } from "react";

/**
 * Evento de atención elegido en el selector de ubicación de Inicio. Se comparte
 * con otras pantallas (por ejemplo Atención de Secretaría) sin pasar parámetros.
 * Vive en memoria: se reinicia al cerrar la app, y Inicio lo vuelve a elegir.
 */
let selectedEventId = "";
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => selectedEventId;

export function setSelectedEventId(eventId: string) {
  if (eventId === selectedEventId) return;
  selectedEventId = eventId;
  listeners.forEach((listener) => listener());
}

export function useSelectedEventId() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
