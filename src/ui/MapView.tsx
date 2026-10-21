// Leaflet map. Tiles are online-only (OSM tile policy forbids offline use); stops, route
// lines and the GPS position are drawn from local data and remain visible offline.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'preact/hooks';
import type { LatLng } from '../domain/types';

export interface MapStop {
  id: string;
  label: string;
  position: LatLng;
  state?: 'normaal' | 'actief' | 'klaar';
}

interface Props {
  stops: MapStop[];
  routes: [number, number][][];
  /** Straight dashed lines for pairs without a computed route, clearly not a walking path. */
  gaps?: [LatLng, LatLng][];
  user?: { position: LatLng; accuracyM: number } | null;
  onMapClick?: (p: LatLng) => void;
  /** Changing this re-fits the map to the stops. */
  fitKey?: string;
  dark?: boolean;
  attribution?: string;
}

// Viewport only (not a place record): the map opens on central Tbilisi when a tour has no stops yet.
const DEFAULT_VIEW: L.LatLngExpression = [41.6938, 44.8015];

export function MapView({ stops, routes, gaps = [], user, onMapClick, fitKey, dark, attribution }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true }).setView(DEFAULT_VIEW, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
    }).addTo(m);
    if (attribution) m.attributionControl.addAttribution(attribution);
    m.on('click', (e: L.LeafletMouseEvent) => clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  useEffect(() => {
    const g = layer.current!;
    g.clearLayers();
    for (const line of routes) if (line.length > 1) L.polyline(line, { color: dark ? '#4FA39A' : '#2F6F6A', weight: 4 }).addTo(g);
    for (const [a, b] of gaps) L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#C4962C', weight: 2, dashArray: '4 6' }).addTo(g);
    stops.forEach((s) => {
      L.marker([s.position.lat, s.position.lng], {
        icon: L.divIcon({ className: `stop-pin stop-pin--${s.state ?? 'normaal'}`, html: `<span>${escapeHtml(s.label)}</span>`, iconSize: [28, 28] }),
        keyboard: false,
      }).addTo(g);
    });
    if (user) {
      L.circle([user.position.lat, user.position.lng], { radius: user.accuracyM, color: '#7FC2B8', weight: 1, fillOpacity: 0.15 }).addTo(g);
      L.circleMarker([user.position.lat, user.position.lng], { radius: 7, color: '#F4EFE6', weight: 2, fillColor: '#2F6F6A', fillOpacity: 1 }).addTo(g);
    }
  }, [stops, routes, gaps, user, dark]);

  useEffect(() => {
    const m = map.current!;
    const pts = stops.map((s) => [s.position.lat, s.position.lng] as [number, number]);
    if (pts.length === 1) m.setView(pts[0], 17);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 17 });
  }, [fitKey]);

  return <div ref={el} class={`map ${dark ? 'map--dark' : ''}`} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
