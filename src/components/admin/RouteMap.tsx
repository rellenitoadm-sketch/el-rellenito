'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { RoutePoint } from '@/lib/routes';

export interface MapRoute {
  id: string;
  driver: string;
  status: string;
  color: string;
  points: RoutePoint[];
  /** Destino del cliente (cuando la ruta viene de un pedido). */
  dest?: { lat: number; lng: number } | null;
}

interface Props {
  routes: MapRoute[];
  height?: number;
  /** Modo conductor: sigue la posición actual y traza una línea al destino. */
  follow?: boolean;
}

// Centro por defecto: zona de San Cristóbal / Táchira (donde están las rutas).
const DEFAULT_CENTER: [number, number] = [7.767, -72.225];

export default function RouteMap({ routes, height = 420, follow = false }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const fittedRef = useRef<string>('');
  const [ready, setReady] = useState(false);

  // Inicializa el mapa una sola vez (Leaflet se importa solo en el cliente).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      // Según el modo de interop, el namespace viene directo o bajo `.default`.
      const L: typeof import('leaflet') = mod.default ?? mod;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // Redibuja los recorridos cuando cambian los datos.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer || !ready) return;

    layer.clearLayers();
    const all: [number, number][] = [];

    for (const r of routes) {
      const latlngs = r.points
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map(p => [p.lat, p.lng] as [number, number]);

      if (latlngs.length > 0) {
        L.polyline(latlngs, { color: r.color, weight: 4, opacity: 0.85 }).addTo(layer);

        // Punto de inicio.
        L.circleMarker(latlngs[0], { radius: 5, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: 1 })
          .addTo(layer)
          .bindTooltip(`${r.driver} · inicio`);

        // Punto final / posición actual.
        const last = latlngs[latlngs.length - 1];
        const isActive = r.status === 'active';
        L.circleMarker(last, {
          radius: isActive ? 8 : 5,
          color: '#fff',
          weight: 2,
          fillColor: isActive ? '#16a34a' : r.color,
          fillOpacity: 1,
        })
          .addTo(layer)
          .bindTooltip(`${r.driver}${isActive ? ' · en vivo' : ' · fin'}`);

        all.push(...latlngs);
      }

      // Destino del cliente (si la ruta viene de un pedido).
      if (r.dest && Number.isFinite(r.dest.lat) && Number.isFinite(r.dest.lng)) {
        const d: [number, number] = [r.dest.lat, r.dest.lng];
        L.circleMarker(d, { radius: 7, color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 })
          .addTo(layer)
          .bindTooltip(`Destino · ${r.driver}`);
        all.push(d);
      }
    }

    // Modo conductor: línea punteada de la posición actual al destino + seguir.
    if (follow && routes.length > 0) {
      const r = routes[0];
      const pts = r.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      const cur = pts.length ? ([pts[pts.length - 1].lat, pts[pts.length - 1].lng] as [number, number]) : null;
      const dest = r.dest && Number.isFinite(r.dest.lat) && Number.isFinite(r.dest.lng)
        ? ([r.dest.lat, r.dest.lng] as [number, number]) : null;
      if (cur && dest) {
        L.polyline([cur, dest], { color: '#dc2626', weight: 2, opacity: 0.6, dashArray: '6 8' }).addTo(layer);
        map.fitBounds([cur, dest], { padding: [40, 40], maxZoom: 16 });
      } else if (cur) {
        map.setView(cur, Math.max(map.getZoom(), 15));
      } else if (dest) {
        map.setView(dest, 15);
      }
      return;
    }

    // Ajusta el encuadre solo cuando cambia el conjunto de rutas mostradas
    // (no en cada actualización de posición, para no marear al verlo en vivo).
    const sig = routes.map(r => r.id).sort().join(',');
    if (all.length > 0 && fittedRef.current !== sig) {
      map.fitBounds(all, { padding: [30, 30], maxZoom: 16 });
      fittedRef.current = sig;
    }
  }, [routes, ready, follow]);

  return (
    <div
      ref={elRef}
      style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 0, background: 'var(--surface-2)' }}
    />
  );
}
