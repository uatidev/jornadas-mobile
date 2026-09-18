"use client";

import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useState } from "react";

// Importar leaflet CSS solo en el cliente para evitar errores de SSR ("window is not defined")
if (typeof window !== "undefined") {
  require("leaflet/dist/leaflet.css");
}
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { View } from "react-native";

type SearchResult = {
  place_id: number | string;
  display_name: string;
  lat?: string;
  lon?: string;
  locality?: string;
  postalCode?: string;
  address?: {
    village?: string;
    town?: string;
    city?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    municipality?: string;
    county?: string;
  };
};
const searchCache = new Map<string, SearchResult[]>();

async function searchNominatim(
  term: string,
  bounded = true,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: term,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "mx",
    viewbox: "-94.2,18.7,-90.9,17.2",
    "accept-language": "es",
  });
  if (bounded) params.set("bounded", "1");
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
  );
  if (!response.ok)
    throw new Error("No fue posible consultar el buscador geográfico");
  return response.json();
}

async function reverseNominatim(
  latitude: number,
  longitude: number,
): Promise<SearchResult> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
    "accept-language": "es",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
  );
  if (!response.ok)
    throw new Error("No fue posible identificar la ubicación seleccionada");
  return response.json();
}

function ClickHandler({
  onChange,
}: {
  onChange: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click: (event) => onChange(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function Recenter({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  locality,
  onChange,
  onPlaceSelected,
}: {
  latitude: number;
  longitude: number;
  locality: string;
  onChange: (latitude: number, longitude: number) => void;
  onPlaceSelected: (
    locality: string,
    address: string,
    latitude: number,
    longitude: number,
    municipality: string,
  ) => void;
}) {
  const [query, setQuery] = useState(locality);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [manualLatitude, setManualLatitude] = useState(String(latitude));
  const [manualLongitude, setManualLongitude] = useState(String(longitude));
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const applyManualCoordinates = async () => {
    const lat = Number(manualLatitude.trim().replace(",", "."));
    const lon = Number(manualLongitude.trim().replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setSearchError("Escribe coordenadas numéricas válidas.");
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setSearchError(
        "La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180.",
      );
      return;
    }

    onChange(lat, lon);
    setSearching(true);
    setSearchError(null);
    try {
      const selected = await reverseNominatim(lat, lon);
      const place =
        selected.address?.village ||
        selected.address?.town ||
        selected.address?.suburb ||
        selected.address?.hamlet ||
        selected.address?.city ||
        "Ubicación seleccionada";
      const selectedMunicipality =
        selected.address?.municipality ||
        selected.address?.county ||
        selected.address?.city ||
        "";
      setQuery(place);
      onPlaceSelected(
        place,
        selected.display_name,
        lat,
        lon,
        selectedMunicipality,
      );
    } catch (cause) {
      setSearchError(
        cause instanceof Error
          ? cause.message
          : "No fue posible identificar el punto",
      );
    } finally {
      setSearching(false);
    }
  };

  const search = async () => {
    const term = `${query.trim()}, Tabasco, México`;
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      let data = searchCache.get(term);
      if (!data) {
        if (/^\d{5}$/.test(query.trim())) {
          const postalCode = query.trim();
          try {
            const response = await fetch(
              `https://sepomex.kurenn.dev/api/v1/zip_codes?zip_code=${postalCode}&state=tabasco&per_page=50`,
            );
            if (!response.ok) throw new Error("Catálogo postal no disponible");
            const postal = await response.json();
            const unique = new Map<string, any>();
            for (const item of postal.zip_codes || []) {
              if (String(item.d_estado).toLowerCase() === "tabasco")
                unique.set(item.d_asenta, item);
            }
            data = [...unique.values()].slice(0, 20).map((item) => ({
              place_id: `cp-${item.id}`,
              display_name: `${item.d_asenta}, ${item.d_mnpio}, Tabasco, C.P. ${item.d_codigo}`,
              locality: item.d_asenta,
              postalCode: item.d_codigo,
            }));
          } catch {
            data = [];
          }
          if (!data.length) {
            const fallback = await searchNominatim(
              `${postalCode}, Tabasco, México`,
              false,
            );
            data = fallback.filter((item) =>
              String(item.address?.state || item.display_name)
                .toLowerCase()
                .includes("tabasco"),
            );
          }
        } else {
          data = await searchNominatim(term);
          if (!data.length) {
            const fallback = await searchNominatim(
              `${query.trim()}, Tabasco, México`,
              false,
            );
            data = fallback.filter((item) =>
              String(item.address?.state || item.display_name)
                .toLowerCase()
                .includes("tabasco"),
            );
          }
        }
        searchCache.set(term, data || []);
      }
      setResults(data || []);
      if (!data?.length)
        setSearchError(
          "No se encontraron localidades con ese nombre en Tabasco.",
        );
    } catch (cause) {
      setSearchError(
        cause instanceof Error ? cause.message : "Error de búsqueda",
      );
    } finally {
      setSearching(false);
    }
  };
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar localidad, colonia o C.P. (5 dígitos)"
            onSubmitEditing={search}
          />
        </View>
        <Button onPress={search} disabled={searching}>
          <Text>{searching ? "Buscando..." : "Buscar localidad"}</Text>
        </Button>
      </View>
      {searchError ? (
        <Text className="text-sm text-destructive">{searchError}</Text>
      ) : null}
      {results.length ? (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {results.map((result) => (
            <Button
              key={result.place_id}
              variant="ghost"
              className="h-auto justify-start border-b border-border px-3 py-3"
              onPress={async () => {
                let selected = result;
                if (!result.lat || !result.lon) {
                  setSearching(true);
                  try {
                    const geocoded = await searchNominatim(
                      `${result.locality}, Tabasco, México`,
                    );
                    selected = geocoded[0]
                      ? {
                          ...geocoded[0],
                          locality: result.locality,
                          postalCode: result.postalCode,
                          display_name: result.display_name,
                        }
                      : result;
                  } finally {
                    setSearching(false);
                  }
                }
                const lat = selected.lat ? Number(selected.lat) : latitude;
                const lon = selected.lon ? Number(selected.lon) : longitude;
                const place =
                  selected.locality ||
                  selected.address?.village ||
                  selected.address?.town ||
                  selected.address?.city ||
                  selected.address?.hamlet ||
                  selected.address?.suburb ||
                  query.trim();
                const municipality =
                  selected.address?.municipality ||
                  selected.address?.county ||
                  selected.address?.city ||
                  "";
                setQuery(place);
                setResults([]);
                setManualLatitude(String(lat));
                setManualLongitude(String(lon));
                setSearchError(
                  selected.lat && selected.lon
                    ? null
                    : "La localidad existe en el catálogo postal, pero el mapa no tiene coordenadas exactas. Marca el punto correcto en el mapa.",
                );
                onPlaceSelected(
                  place,
                  selected.display_name,
                  lat,
                  lon,
                  municipality,
                );
              }}
            >
              <Text className="text-left text-sm">{result.display_name}</Text>
            </Button>
          ))}
        </View>
      ) : null}
      <View className="gap-2 rounded-xl border border-border bg-card p-3">
        <Text className="text-sm font-semibold">Capturar coordenadas</Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Input
              value={manualLatitude}
              onChangeText={setManualLatitude}
              placeholder="Latitud, ej. 17.9892"
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={() => void applyManualCoordinates()}
            />
          </View>
          <View className="flex-1">
            <Input
              value={manualLongitude}
              onChangeText={setManualLongitude}
              placeholder="Longitud, ej. -92.9475"
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={() => void applyManualCoordinates()}
            />
          </View>
          <Button
            onPress={() => void applyManualCoordinates()}
            disabled={searching}
          >
            <Text>{searching ? "Ubicando..." : "Aplicar"}</Text>
          </Button>
        </View>
        <Text className="text-xs text-muted-foreground">
          Puedes usar punto o coma como separador decimal.
        </Text>
      </View>
      <div
        style={{
          height: 360,
          width: "100%",
          overflow: "hidden",
          borderRadius: 14,
          backgroundColor: "#f4f4f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {mounted ? (
          <MapContainer
            center={[latitude, longitude]}
            zoom={9}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker
              center={[latitude, longitude]}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#981646",
                fillOpacity: 1,
                weight: 3,
              }}
            />
            <ClickHandler
              onChange={async (lat, lon) => {
                setManualLatitude(String(lat));
                setManualLongitude(String(lon));
                onChange(lat, lon);
                setSearching(true);
                setSearchError(null);
                try {
                  const selected = await reverseNominatim(lat, lon);
                  const place =
                    selected.address?.village ||
                    selected.address?.town ||
                    selected.address?.suburb ||
                    selected.address?.hamlet ||
                    selected.address?.city ||
                    "Ubicación seleccionada";
                  const selectedMunicipality =
                    selected.address?.municipality ||
                    selected.address?.county ||
                    selected.address?.city ||
                    "";
                  setQuery(place);
                  onPlaceSelected(
                    place,
                    selected.display_name,
                    lat,
                    lon,
                    selectedMunicipality,
                  );
                } catch (cause) {
                  setSearchError(
                    cause instanceof Error
                      ? cause.message
                      : "No fue posible identificar el punto",
                  );
                } finally {
                  setSearching(false);
                }
              }}
            />
            <Recenter latitude={latitude} longitude={longitude} />
          </MapContainer>
        ) : (
          <span style={{ color: "#71717a", fontSize: 13 }}>
            Cargando mapa...
          </span>
        )}
      </div>
    </View>
  );
}
