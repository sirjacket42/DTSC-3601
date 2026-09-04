"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TRACK_SOURCE_ID = "circuit-track";
const TRACK_LAYER_ID = "circuit-track-line";

function buildMarkerEl() {
  const el = document.createElement("div");
  el.innerHTML = `<span class="block size-3.5 rounded-full bg-[#e00700] ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"></span>`;
  return el.firstElementChild as HTMLElement;
}

function trackBounds(track: [number, number][]) {
  const bounds = new mapboxgl.LngLatBounds(track[0], track[0]);
  for (const point of track) bounds.extend(point);
  return bounds;
}

function focusOnRace(map: mapboxgl.Map, lat: number, lng: number, track: [number, number][] | null) {
  if (track && track.length > 1) {
    map.fitBounds(trackBounds(track), { padding: 80, duration: 800 });
  } else {
    map.flyTo({ center: [lng, lat], zoom: 13, essential: true });
  }
}

function applyTrack(map: mapboxgl.Map, track: [number, number][] | null) {
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: track ?? [] },
  };

  const source = map.getSource(TRACK_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
  } else {
    map.addSource(TRACK_SOURCE_ID, { type: "geojson", data });
    map.addLayer({
      id: TRACK_LAYER_ID,
      type: "line",
      source: TRACK_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#a3272c",
        "line-width": 4,
        "line-opacity": 0.95,
      },
    });
  }
}

export function RaceMap({
  lat,
  lng,
  track,
}: {
  lat: number;
  lng: number;
  track?: [number, number][] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [lng, lat],
      zoom: 13,
      scrollZoom: false,
      attributionControl: true,
    });

    const marker = new mapboxgl.Marker({ element: buildMarkerEl() })
      .setLngLat([lng, lat])
      .addTo(map);

    map.on("style.load", () => {
      map.setConfigProperty("basemap", "lightPreset", "night");
      map.setConfigProperty("basemap", "show3dObjects", false);
    });

    map.on("load", () => {
      applyTrack(map, track ?? null);
      focusOnRace(map, lat, lng, track ?? null);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerRef.current) return;
    markerRef.current.setLngLat([lng, lat]);

    const run = () => {
      applyTrack(map, track ?? null);
      focusOnRace(map, lat, lng, track ?? null);
    };
    if (map.isStyleLoaded()) run();
    else map.once("load", run);
  }, [lat, lng, track]);

  if (!TOKEN) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card text-center text-sm text-muted-foreground px-4">
        <p>Map disabled — set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</p>
        <p className="text-xs">Get a free token at mapbox.com</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
