'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { fetchDrivingRoute, haversineMeters, type RoutePoint } from '@/lib/routes';

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

/**
 * Salto entre dos fijaciones GPS consecutivas a partir del cual dejó de haber
 * registro (app cerrada, sin señal). Unir esos dos puntos con una recta dibuja
 * una línea que atraviesa las cuadras: en su lugar se pide el camino real por
 * calles y se dibuja punteado para dejar claro que es estimado.
 */
const GAP_M = 150;
/** Tope de tramos estimados por redibujado (no saturar el servicio de rutas). */
const MAX_GAPS = 8;

type Segment = { line: [number, number][]; estimated: boolean };

/** Parte el recorrido en tramos registrados y huecos (con el camino por calles si ya se pidió). */
function buildSegments(
  latlngs: [number, number][],
  gapLines: Map<string, [number, number][]>,
  request: (key: string, from: [number, number], to: [number, number]) => void,
): Segment[] {
  const segments: Segment[] = [];
  let run: [number, number][] = latlngs.length ? [latlngs[0]] : [];
  let gapsSeen = 0;

  for (let i = 1; i < latlngs.length; i++) {
    const a = latlngs[i - 1];
    const b = latlngs[i];
    const jump = haversineMeters({ lat: a[0], lng: a[1], t: 0 }, { lat: b[0], lng: b[1], t: 0 });
    if (jump < GAP_M) { run.push(b); continue; }

    if (run.length > 1) segments.push({ line: run, estimated: false });
    const key = `${a[0].toFixed(4)},${a[1].toFixed(4)}|${b[0].toFixed(4)},${b[1].toFixed(4)}`;
    const road = gapLines.get(key);
    if (road) {
      segments.push({ line: road, estimated: true });
    } else {
      if (gapsSeen < MAX_GAPS) request(key, a, b);
      segments.push({ line: [a, b], estimated: true });
    }
    gapsSeen++;
    run = [b];
  }
  if (run.length > 1) segments.push({ line: run, estimated: false });
  return segments;
}

export default function RouteMap({ routes, height = 420, follow = false }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const fittedRef = useRef<string>('');
  const [ready, setReady] = useState(false);
  // Recorrido por calles para la línea al destino en modo conductor.
  const [roadRoute, setRoadRoute] = useState<{ key: string; line: [number, number][] } | null>(null);
  const roadKeyRef = useRef<string>('');
  // Caminos por calles ya resueltos para los huecos del recorrido.
  const gapLinesRef = useRef<Map<string, [number, number][]>>(new Map());
  const gapPendingRef = useRef<Set<string>>(new Set());
  const [gapVersion, setGapVersion] = useState(0);

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

    const requestGap = (key: string, from: [number, number], to: [number, number]) => {
      if (gapPendingRef.current.has(key)) return;
      gapPendingRef.current.add(key);
      fetchDrivingRoute({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] }).then(line => {
        gapPendingRef.current.delete(key);
        if (!line) return;
        gapLinesRef.current.set(key, line);
        setGapVersion(v => v + 1);
      });
    };

    for (const r of routes) {
      const latlngs = r.points
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map(p => [p.lat, p.lng] as [number, number]);

      if (latlngs.length > 0) {
        // Tramos con registro GPS: línea sólida. Huecos: camino por calles punteado.
        for (const seg of buildSegments(latlngs, gapLinesRef.current, requestGap)) {
          const poly = L.polyline(seg.line, seg.estimated
            ? { color: r.color, weight: 3, opacity: 0.55, dashArray: '6 8' }
            : { color: r.color, weight: 4, opacity: 0.85 });
          if (seg.estimated) poly.bindTooltip(`${r.driver} · tramo estimado (sin señal)`);
          poly.addTo(layer);
        }

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

    // Modo conductor: traza el camino POR CALLES de la posición actual al destino.
    if (follow && routes.length > 0) {
      const r = routes[0];
      const pts = r.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      const cur = pts.length ? ([pts[pts.length - 1].lat, pts[pts.length - 1].lng] as [number, number]) : null;
      const dest = r.dest && Number.isFinite(r.dest.lat) && Number.isFinite(r.dest.lng)
        ? ([r.dest.lat, r.dest.lng] as [number, number]) : null;
      if (cur && dest) {
        // Clave redondeada (~110 m en origen) para no re-pedir la ruta a OSRM en
        // cada tick del GPS; solo se recalcula cuando el conductor avanza un tramo.
        const key = `${cur[0].toFixed(3)},${cur[1].toFixed(3)}|${dest[0].toFixed(4)},${dest[1].toFixed(4)}`;
        if (key !== roadKeyRef.current) {
          roadKeyRef.current = key;
          fetchDrivingRoute({ lat: cur[0], lng: cur[1] }, { lat: dest[0], lng: dest[1] })
            .then(line => { if (line && roadKeyRef.current === key) setRoadRoute({ key, line }); });
        }
        const line = roadRoute && roadRoute.key === key ? roadRoute.line : null;
        if (line) {
          // Camino real por las vías (sólido).
          L.polyline(line, { color: '#dc2626', weight: 4, opacity: 0.8 }).addTo(layer);
          map.fitBounds(line, { padding: [40, 40], maxZoom: 16 });
        } else {
          // Respaldo: recta punteada mientras llega la ruta (o si OSRM falla).
          L.polyline([cur, dest], { color: '#dc2626', weight: 2, opacity: 0.6, dashArray: '6 8' }).addTo(layer);
          map.fitBounds([cur, dest], { padding: [40, 40], maxZoom: 16 });
        }
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
  }, [routes, ready, follow, roadRoute, gapVersion]);

  return (
    <div
      ref={elRef}
      style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 0, background: 'var(--surface-2)' }}
    />
  );
}
