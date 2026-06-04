'use client';

import { useCallback, useState } from 'react';
import { detectZoneFromCoords, reverseGeocode, type CoordZoneResult } from '@/lib/zoneDetection';

export interface GeolocationZone {
  coords: { lat: number; lng: number } | null;
  zone: CoordZoneResult | null;
  address: string;
  loading: boolean;
  error: string;
  detect: () => void;
  reset: () => void;
}

/**
 * Captura la ubicación del navegador y resuelve la zona de entrega real por
 * coordenadas. La zona/precio salen de inmediato (cálculo local); la dirección
 * legible (reverse-geocoding) llega de forma asíncrona porque es solo referencia.
 *
 * Usado por el checkout al detal y por la página Al Mayor.
 */
export function useGeolocationZone(): GeolocationZone {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zone, setZone] = useState<CoordZoneResult | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const detect = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Tu dispositivo no permite compartir ubicación.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setZone(detectZoneFromCoords(latitude, longitude));
        setLoading(false); // zona/precio ya listos; la dirección es opcional
        reverseGeocode(latitude, longitude)
          .then(setAddress)
          .catch(() => { /* dirección es solo referencia */ });
      },
      err => {
        setError(
          err.code === 1
            ? 'Permiso de ubicación denegado.'
            : 'No pudimos obtener tu ubicación. Intenta de nuevo.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const reset = useCallback(() => {
    setCoords(null);
    setZone(null);
    setAddress('');
    setError('');
  }, []);

  return { coords, zone, address, loading, error, detect, reset };
}
