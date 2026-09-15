"use client";

import municipalitiesData from "@/src/assets/tabasco-municipios.json";
import { municipalityFolioCode, resolveTabascoMunicipality } from "@/src/constants/tabasco";
import type { AttentionEvent } from "@/src/types/catalog";
import type { Feature, GeoJsonObject } from "geojson";
import type { Layer } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

if (typeof window !== "undefined") require("leaflet/dist/leaflet.css");

type MunicipalityProperties = { nomgeo?: string; cvegeo?: string };

function ResizeMap({ expanded }: { expanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(timer);
  }, [expanded, map]);
  return null;
}

export function MunicipalEventsMap({ events, requestCounts }: {
  events: AttentionEvent[];
  requestCounts: Record<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const municipalityStats = useMemo(() => {
    const result = new Map<string, { events: AttentionEvent[]; requests: number }>();
    for (const event of events) {
      const municipality = resolveTabascoMunicipality(event.municipality) || event.municipality;
      const key = municipalityFolioCode(municipality);
      const current = result.get(key) || { events: [], requests: 0 };
      current.events.push(event);
      current.requests += requestCounts[event.id] || 0;
      result.set(key, current);
    }
    return result;
  }, [events, requestCounts]);
  const selectedKey = municipalityFolioCode(selectedMunicipality);
  const selectedStats = municipalityStats.get(selectedKey) || { events: [], requests: 0 };

  useEffect(() => {
    const sync = () => setExpanded(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen();
  };

  const getMunicipality = (feature?: Feature) => resolveTabascoMunicipality(String((feature?.properties as MunicipalityProperties | undefined)?.nomgeo || ""));

  return (
    <div ref={containerRef} className="relative grid w-full grid-cols-[minmax(0,1fr)_360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white max-lg:grid-cols-1">
      <div style={{ height: expanded ? "100vh" : 650 }}>
        <MapContainer center={[17.8409, -92.6189]} zoom={8} style={{ height: "100%", width: "100%" }} maxBounds={[[16.8, -95], [19.2, -90.5]]}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ResizeMap expanded={expanded} />
          <GeoJSON
            key={selectedKey || "sin-seleccion"}
            data={municipalitiesData as GeoJsonObject}
            style={(feature) => {
              const municipality = getMunicipality(feature);
              const selected = municipalityFolioCode(municipality) === selectedKey;
              return { color: selected ? "#4c0b24" : "#981646", weight: selected ? 4 : 1.5, fillColor: selected ? "#b91c5c" : "#ffffff", fillOpacity: selected ? 0.72 : 0.04 };
            }}
            onEachFeature={(feature, layer: Layer) => {
              const municipality = getMunicipality(feature);
              layer.on({
                click: (event) => {
                  setSelectedMunicipality(municipality);
                  const target = event.target as Layer & { getBounds?: () => Parameters<ReturnType<typeof useMap>["fitBounds"]>[0] };
                  if (target.getBounds) event.target._map.fitBounds(target.getBounds(), { padding: [30, 30], maxZoom: 11 });
                },
                mouseover: (event) => event.target.setStyle({ color: "#4c0b24", weight: 4, fillColor: "#b91c5c", fillOpacity: 0.72 }),
                mouseout: (event) => {
                  const selected = municipalityFolioCode(municipality) === selectedKey;
                  event.target.setStyle({ color: selected ? "#4c0b24" : "#981646", weight: selected ? 4 : 1.5, fillColor: selected ? "#b91c5c" : "#ffffff", fillOpacity: selected ? 0.72 : 0.04 });
                },
              });
              layer.bindTooltip(`${municipality}<br><strong>${municipalityStats.get(municipalityFolioCode(municipality))?.events.length || 0} eventos</strong>`, { sticky: true });
            }}
          />
        </MapContainer>
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={expanded ? "Salir de pantalla completa" : "Ver mapa en pantalla completa"}
        title={expanded ? "Salir de pantalla completa" : "Ver mapa en pantalla completa"}
        className="absolute left-4 top-4 z-[1100] grid h-11 w-11 place-items-center rounded-xl bg-white text-2xl font-bold leading-none text-zinc-800 shadow-lg hover:bg-zinc-100"
      >
        <span aria-hidden="true">{expanded ? "↙" : "⛶"}</span>
      </button>
      <aside className={`${expanded ? "absolute bottom-5 right-5 top-5 z-[1100] w-[380px] rounded-2xl shadow-2xl" : "border-l border-zinc-200"} overflow-y-auto bg-white/95 p-6 backdrop-blur max-lg:border-l-0 max-lg:border-t`}>
        {selectedMunicipality ? <div className="grid gap-5">
          <div><TextLabel>Municipio seleccionado</TextLabel><h3 className="mt-1 text-2xl font-bold text-zinc-900">{selectedMunicipality}</h3></div>
          <div className="grid grid-cols-2 gap-3"><Stat label="Eventos" value={selectedStats.events.length} /><Stat label="Solicitudes" value={selectedStats.requests} /></div>
          <div><h4 className="mb-3 font-bold text-zinc-900">Eventos realizados</h4><div className="grid gap-2">{selectedStats.events.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).map((event) => <div key={event.id} className="rounded-xl bg-zinc-100 p-3"><strong className="block">{event.name}</strong><span className="text-sm text-zinc-500">{new Date(event.startsAt).toLocaleDateString("es-MX")} · {event.locality}</span><span className="mt-1 block text-sm font-semibold text-primary">{requestCounts[event.id] || 0} solicitudes</span></div>)}{!selectedStats.events.length ? <span className="text-sm text-zinc-500">No hay eventos registrados en este municipio.</span> : null}</div></div>
        </div> : <div className="grid h-full place-content-center text-center text-zinc-500"><div className="text-4xl">⌖</div><strong className="mt-2 text-zinc-700">Selecciona un municipio</strong><span className="mt-1 max-w-64 text-sm">Haz clic en una zona del mapa para conocer sus eventos y solicitudes.</span></div>}
      </aside>
    </div>
  );
}

function TextLabel({ children }: { children: string }) {
  return <span className="text-xs font-bold uppercase tracking-wide text-primary">{children}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-primary/10 p-4"><span className="block text-xs font-bold text-primary">{label.toUpperCase()}</span><strong className="mt-1 block text-3xl text-zinc-900">{value}</strong></div>;
}
