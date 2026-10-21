/**
 * Map with a draggable pin (OpenStreetMap tiles via Leaflet, no API key).
 * Drag the pin or tap the map to move it. Loaded lazily so Leaflet only downloads when a buyer orders.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLngValue { lat: number; lng: number }

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#e11d48;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const shopIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:6px;background:#4f46e5;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function PinPickerMap({
  value,
  onChange,
  fallbackCenter,
  shop,
  className = 'h-64',
}: {
  value: LatLngValue | null;
  onChange: (p: LatLngValue) => void;
  /** Where to centre the map before a pin is placed (e.g. the shop). */
  fallbackCenter?: LatLngValue | null;
  /** Optional shop marker (not draggable). */
  shop?: LatLngValue | null;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const start = value || fallbackCenter || { lat: 20, lng: 0 };
    const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : fallbackCenter ? 12 : 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    if (shop) L.marker([shop.lat, shop.lng], { icon: shopIcon, interactive: false }).addTo(map);
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    const place = (lat: number, lng: number) => {
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true, autoPan: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLatLng();
          onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) });
        });
      } else markerRef.current.setLatLng([lat, lng]);
    };
    if (value) place(value.lat, value.lng);
    map.on('click', (e: L.LeafletMouseEvent) => {
      place(e.latlng.lat, e.latlng.lng);
      onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) });
    });
    mapRef.current = map;
    // The map is often inside a modal that is still animating in.
    const t = window.setTimeout(() => map.invalidateSize(), 200);
    (map as any)._placePin = place;
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pin moved from outside (e.g. "Use my location").
  useEffect(() => {
    const map = mapRef.current as any;
    if (!map || !value) return;
    const cur = markerRef.current?.getLatLng();
    if (cur && Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
    map._placePin(value.lat, value.lng);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={boxRef} className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-0 ${className}`} role="application" aria-label="Map. Drag the red pin or tap the map to set the delivery spot." />;
}
