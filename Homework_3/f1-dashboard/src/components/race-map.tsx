"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function buildMarkerEl() {
  const el = document.createElement("div");
  el.innerHTML = `<span class="relative flex size-4">
    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e00700] opacity-60"></span>
    <span class="relative inline-flex size-4 rounded-full bg-[#e00700] ring-2 ring-white"></span>
  </span>`;
  return el.firstElementChild as HTMLElement;
}

export function RaceMap({
  lat,
  lng,
  label,
  sublabel,
}: {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 12,
      scrollZoom: false,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
      `<div style="font-weight:600">${label}</div>${
        sublabel ? `<div style="font-size:12px;opacity:0.7">${sublabel}</div>` : ""
      }`
    );

    const marker = new mapboxgl.Marker({ element: buildMarkerEl() })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

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
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([lng, lat]);
    mapRef.current.flyTo({ center: [lng, lat], zoom: 12, essential: true });
  }, [lat, lng]);

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
