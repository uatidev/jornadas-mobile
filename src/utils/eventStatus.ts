import type { AttentionEvent } from "@/src/types/catalog";

export type EventStatus = "Activo" | "Programado" | "Finalizado";

/**
 * Estado real del evento. Misma regla que el panel web y que la función
 * identity-api al recibir solicitudes: el indicador `activo` solo habilita el
 * evento; además debe estar dentro de su rango de fechas.
 */
export function getEventStatus(event: AttentionEvent, now = Date.now()): EventStatus {
  const startsAt = new Date(event.startsAt).getTime();
  const endsAt = new Date(event.endsAt).getTime();
  if (!event.active || !Number.isFinite(endsAt) || endsAt < now) return "Finalizado";
  if (Number.isFinite(startsAt) && startsAt > now) return "Programado";
  return "Activo";
}

const dateFormat: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/** "12 oct 2026, 09:00 – 18:00" o "12 oct 2026, 09:00 – 14 oct 2026, 18:00". */
export function formatEventRange(event: AttentionEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const startText = `${start.toLocaleDateString("es-MX", dateFormat)}, ${start.toLocaleTimeString("es-MX", timeFormat)}`;
  if (Number.isNaN(end.getTime())) return startText;
  const sameDay = start.toDateString() === end.toDateString();
  const endText = sameDay
    ? end.toLocaleTimeString("es-MX", timeFormat)
    : `${end.toLocaleDateString("es-MX", dateFormat)}, ${end.toLocaleTimeString("es-MX", timeFormat)}`;
  return `${startText} – ${endText}`;
}
