'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, Trash2, Star } from 'lucide-react';
import { categories, categoryLabels, type Product, type ProductCategory, type ProductType } from '@/lib/products';
import type { ExchangeRates } from '@/lib/rates';

interface ProductEditorProps {
  product: Product | null; // null = creating new
  rates: ExchangeRates;
  onClose: () => void;
  onSaved: (p: Product) => void;
  onDeleted: (id: string) => void;
}

const TYPE_OPTIONS: { id: ProductType; label: string }[] = [
  { id: 'detal', label: 'Detal' },
  { id: 'mayorista', label: 'Al Mayor' },
  { id: 'ambos', label: 'Ambos' },
];

export default function ProductEditor({ product, rates, onClose, onSaved, onDeleted }: ProductEditorProps) {
  const isNew = product === null;
  const [name, setName] = useState(product?.name ?? '');
  const [units, setUnits] = useState(product?.units ?? '');
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? 'TEQUEÑOS');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceUsd, setPriceUsd] = useState(product?.price_usd?.toString() ?? '');
  const [wholesaleUsd, setWholesaleUsd] = useState(product?.wholesale_price_usd?.toString() ?? '');
  const [type, setType] = useState<ProductType>(product?.type ?? 'detal');
  const [available, setAvailable] = useState(product?.available ?? true);
  const [bestSeller, setBestSeller] = useState(product?.is_best_seller ?? false);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const usd = parseFloat(priceUsd) || 0;
  const cop = Math.round(usd * rates.cop_per_usd);
  const bs = Math.round(usd * rates.bs_per_usd);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al subir');
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      units: units.trim() || null,
      category,
      description: description.trim(),
      price_usd: usd,
      wholesale_price_usd: parseFloat(wholesaleUsd) || usd,
      type,
      available,
      is_best_seller: bestSeller,
      image_url: imageUrl,
    };
    try {
      const res = await fetch(
        isNew ? '/api/products' : `/api/products/${product!.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      onSaved(data as Product); // parent unmounts this editor
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
      setSaving(false); // only reached on failure (success unmounts)
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error'); }
      onDeleted(product.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
            {isNew ? 'Nuevo producto' : 'Editar producto'}
          </h3>
          <button onClick={onClose} className="p-1" style={{ color: 'var(--text-3)' }}><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Image */}
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--text-2)' }}>Imagen</label>
            <div className="flex items-center gap-3">
              <div
                className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                {imageUrl
                  ? <Image src={imageUrl} alt="" width={80} height={80} className="object-cover w-full h-full" unoptimized />
                  : <Upload className="w-6 h-6" style={{ color: 'var(--text-3)' }} />}
              </div>
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn btn-ghost text-[13px] w-full"
                  style={{ border: '1px solid var(--border)' }}
                >
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</> : 'Subir foto'}
                </button>
                {imageUrl && (
                  <button onClick={() => setImageUrl(null)} className="text-[11px] mt-1.5" style={{ color: 'var(--danger)' }}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Tequeño Super Queso" className="field" />
          </div>

          {/* Units (subtitle) */}
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Unidades / presentación</label>
            <input value={units} onChange={e => setUnits(e.target.value)} placeholder="Ej. 25 unidades · 1 kg · Pack x10" className="field" />
          </div>

          {/* Category */}
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value as ProductCategory)} className="field">
              {categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Breve descripción del producto" className="field resize-none" />
          </div>

          {/* Price USD + auto COP/BS */}
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Precio al detal (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold" style={{ color: 'var(--text-3)' }}>$</span>
              <input type="number" inputMode="decimal" step="0.01" value={priceUsd} onChange={e => setPriceUsd(e.target.value)} placeholder="0.00" className="field" style={{ paddingLeft: '1.75rem' }} />
            </div>
            <div className="flex gap-2 mt-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
              <span className="px-2 py-0.5 rounded-md" style={{ background: 'var(--surface-2)' }}>≈ COP {cop.toLocaleString('es-CO')}</span>
              <span className="px-2 py-0.5 rounded-md" style={{ background: 'var(--surface-2)' }}>≈ Bs {bs.toLocaleString('es-VE')}</span>
            </div>
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>
              COP y Bs se calculan solos con la tasa del día. Solo editas el USD.
            </p>
          </div>

          {/* Wholesale price (only if type involves mayorista) */}
          {(type === 'mayorista' || type === 'ambos') && (
            <div>
              <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--text-2)' }}>Precio al mayor (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold" style={{ color: 'var(--text-3)' }}>$</span>
                <input type="number" inputMode="decimal" step="0.01" value={wholesaleUsd} onChange={e => setWholesaleUsd(e.target.value)} placeholder="igual al detal" className="field" style={{ paddingLeft: '1.75rem' }} />
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: 'var(--text-2)' }}>Disponible para</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className="py-2 rounded-xl text-[13px] font-semibold border transition-all"
                  style={type === t.id
                    ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' }
                    : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => setAvailable(a => !a)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-all"
              style={available
                ? { borderColor: 'var(--success)', background: 'var(--success-soft)', color: '#15803D' }
                : { borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}
            >
              {available ? '✓ Disponible' : 'Agotado'}
            </button>
            <button
              onClick={() => setBestSeller(b => !b)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-all inline-flex items-center justify-center gap-1.5"
              style={bestSeller
                ? { borderColor: 'var(--accent)', background: 'rgba(251,77,10,0.1)', color: 'var(--brand-deep)' }
                : { borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}
            >
              <Star className={`w-3.5 h-3.5 ${bestSeller ? 'fill-current' : ''}`} /> Destacado
            </button>
          </div>

          {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex-shrink-0 flex gap-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-3 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}
              aria-label="Eliminar"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex-1 btn-gradient text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : (isNew ? 'Crear producto' : 'Guardar cambios')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
