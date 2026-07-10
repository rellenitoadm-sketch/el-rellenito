'use client';

import { useEffect } from 'react';

/**
 * Red de seguridad del panel admin/equipo. Si CUALQUIER componente del panel
 * lanza un error al renderizar (un dato inesperado, una imagen rota, etc.),
 * Next lo captura aquí y muestra un botón de reintento EN EL SITIO — sin
 * mandar al usuario a Home ni perder la sesión. Antes, sin este boundary, un
 * solo producto con un valor raro tumbaba toda la vista.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: 'var(--bg)' }}>
      <p className="text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>Algo se trabó</p>
      <p className="text-[12.5px] max-w-xs" style={{ color: 'var(--text-3)' }}>
        Tus datos están a salvo. Toca para volver a cargar esta sección.
      </p>
      <button
        onClick={reset}
        className="btn-gradient text-white font-bold px-5 py-3 rounded-xl"
      >
        Reintentar
      </button>
    </div>
  );
}
