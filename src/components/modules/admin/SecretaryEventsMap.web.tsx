"use client";

import type { AttentionEvent } from "@/src/types/catalog";
import { latLngBounds } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

if (typeof window !== "undefined") require("leaflet/dist/leaflet.css");

function FitEvents({ events }: { events: AttentionEvent[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = events.filter((event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude));
    if (valid.length) {
      map.fitBounds(latLngBounds(valid.map((event) => [event.latitude, event.longitude])), { padding: [35, 35], maxZoom: 14 });
    } else {
      map.setView([17.8409, -92.6189], 8);
    }
  }, [events, map]);
  return null;
}

function ResizeMap({ expanded }: { expanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    const frame = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(frame);
  }, [expanded, map]);
  return null;
}

const eventDate = (value: string) => new Date(value).toLocaleString("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

export function SecretaryEventsMap({ events, requestCounts = {}, height = 430, autoSelect = false, immersive = false, fullscreenContent }: {
  events: AttentionEvent[];
  requestCounts?: Record<string, number>;
  height?: number;
  autoSelect?: boolean;
  immersive?: boolean;
  fullscreenContent?: ReactNode;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventsWithLocation = useMemo(() => events.flatMap((event) => {
    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ ...event, latitude, longitude }] : [];
  }), [events]);
  const selectedEvent = eventsWithLocation.find((event) => event.id === selectedEventId)
    || (autoSelect && eventsWithLocation.length === 1 ? eventsWithLocation[0] : undefined);
  const selectedEventIsActive = Boolean(selectedEvent?.active && new Date(selectedEvent.endsAt).getTime() >= renderedAt);

  useEffect(() => {
    const syncFullscreenState = () => setExpanded(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen();
  };

  return (
    <div ref={containerRef} className={`${expanded ? "block h-screen w-screen overflow-y-auto rounded-none" : "relative grid w-full overflow-hidden rounded-2xl"} ${!expanded && (immersive ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_340px] max-lg:grid-cols-1")} border border-zinc-200 bg-white`} style={{ minHeight: expanded ? "100vh" : height }}>
      <div className="min-w-0" style={{ height: expanded ? "100vh" : height }}>
        <MapContainer center={[17.8409, -92.6189]} zoom={8} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitEvents events={eventsWithLocation} />
          <ResizeMap expanded={expanded} />
          {eventsWithLocation.map((event) => (
            <CircleMarker
              key={event.id}
              center={[event.latitude, event.longitude]}
              radius={9}
              pathOptions={{ color: selectedEvent?.id === event.id ? "#4c0b24" : "#7a1239", fillColor: "#b91c5c", fillOpacity: 0.85, weight: selectedEvent?.id === event.id ? 4 : 2 }}
              eventHandlers={{ click: () => setSelectedEventId(event.id) }}
            />
          ))}
        </MapContainer>
      </div>
      {immersive ? <button type="button" onClick={toggleFullscreen} className={`${expanded ? "fixed" : "absolute"} left-4 top-4 z-[1100] rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-800 shadow-lg hover:bg-zinc-100`}>{expanded ? "Salir de pantalla completa" : "Ver en pantalla completa"}</button> : null}
      <aside className={`${immersive ? `${expanded ? "fixed" : "absolute"} bottom-5 right-5 top-5 z-[1100] w-[360px] rounded-2xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur max-md:left-4 max-md:right-4 max-md:top-auto max-md:w-auto max-md:max-h-[45%]` : "border-l border-zinc-200 bg-white max-lg:border-l-0 max-lg:border-t"} overflow-y-auto p-6`}>
        {selectedEvent ? (
          <div className="grid gap-5 leading-relaxed">
            <div>
              <span className={`text-xs font-bold uppercase ${selectedEventIsActive ? "text-green-700" : "text-zinc-500"}`}>
                {selectedEventIsActive ? "Evento activo" : "Evento finalizado"}
              </span>
              <h3 className="mt-1 text-xl font-bold text-zinc-900">{selectedEvent.name}</h3>
            </div>
            <div><strong>Ubicación</strong><div>{selectedEvent.venue || selectedEvent.locality}</div>{selectedEvent.address ? <div className="text-zinc-500">{selectedEvent.address}</div> : null}<div className="text-zinc-500">{selectedEvent.locality}, {selectedEvent.municipality}</div></div>
            <div><strong>Inicio</strong><div>{eventDate(selectedEvent.startsAt)}</div></div>
            <div><strong>Término</strong><div>{eventDate(selectedEvent.endsAt)}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-zinc-100 p-3"><strong className="block text-xs text-zinc-500">FOLIO</strong>{selectedEvent.folioPrefix}</div>
              <div className="rounded-xl bg-primary/10 p-3"><strong className="block text-xs text-primary">SOLICITUDES</strong>{requestCounts[selectedEvent.id] || 0}</div>
            </div>
            {selectedEvent.notes ? <div className="border-t border-zinc-200 pt-4"><strong>Información adicional</strong><div className="mt-1 text-zinc-600">{selectedEvent.notes}</div></div> : null}
          </div>
        ) : (
          <div className="grid h-full place-content-center text-center text-zinc-500">
            <div className="text-4xl">⌖</div>
            <strong className="mt-2 text-zinc-700">Selecciona un evento</strong>
            <span className="mt-1 max-w-60 text-sm">Haz clic en un marcador para consultar su información.</span>
          </div>
        )}
      </aside>
      {expanded && fullscreenContent ? <section className="min-h-screen bg-zinc-50 p-8">{fullscreenContent}</section> : null}
    </div>
  );
}
