'use client';

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary flex-1 justify-center" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
