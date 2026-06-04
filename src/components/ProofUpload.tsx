'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, ImageIcon, X, CheckCircle } from 'lucide-react';

export interface ProofData {
  type: 'reference' | 'image';
  reference?: string;
  imageFile?: File;
  imagePreview?: string;
}

interface ProofUploadProps {
  value: ProofData | null;
  onChange: (data: ProofData | null) => void;
}

export default function ProofUpload({ value, onChange }: ProofUploadProps) {
  const [mode, setMode] = useState<'reference' | 'image'>('reference');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleReference = (ref: string) => {
    if (!ref.trim()) {
      onChange(null);
      return;
    }
    onChange({ type: 'reference', reference: ref.trim() });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      onChange({
        type: 'image',
        imageFile: file,
        imagePreview: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    onChange(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const hasProof = !!value;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Comprobante de pago <span style={{ color: 'var(--destructive)' }}>*</span>
        </p>
        {hasProof && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--success)' }}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Listo
          </motion.div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl p-1 border gap-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        {[
          { id: 'reference' as const, label: 'Nro. de referencia', Icon: Hash },
          { id: 'image' as const, label: 'Foto del comprobante', Icon: ImageIcon },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); clear(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={mode === id
              ? { background: 'var(--gradient-button)', color: '#fff' }
              : { color: 'var(--text-secondary)' }
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <AnimatePresence mode="wait">
        {mode === 'reference' ? (
          <motion.div
            key="reference"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="text"
              placeholder="Ej. 12345678 (últimos 8 dígitos)"
              value={value?.type === 'reference' ? value.reference ?? '' : ''}
              onChange={e => handleReference(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm border focus:outline-none transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="image"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {value?.type === 'image' && value.imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.imagePreview}
                  alt="Comprobante"
                  className="w-full max-h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={clear}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-[#ef4444] transition-colors"
                  aria-label="Quitar imagen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <ImageIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toca para adjuntar foto</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>JPG, PNG, WEBP</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
