'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isClosedDay } from '@/lib/businessHours';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const TIME_SLOTS = [
  '8:00 AM – 10:00 AM',
  '10:00 AM – 12:00 PM',
  '2:00 PM – 4:00 PM',
  '4:00 PM – 6:00 PM',
];

interface DatePickerProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
}

export default function WholesaleDatePicker({ selectedDate, selectedTime, onDateChange, onTimeChange }: DatePickerProps) {
  // Pedidos con 24h de anticipación → fecha mínima = mañana
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + 1);

  const [viewMonth, setViewMonth] = useState(minDate.getMonth());
  const [viewYear, setViewYear] = useState(minDate.getFullYear());

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d < minDate;
  };

  const isClosed = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return isClosedDay(d);
  };

  const isDisabled = (day: number) => isPast(day) || isClosed(day);

  const isSelected = (day: number) =>
    selectedDate !== null &&
    selectedDate.getDate() === day &&
    selectedDate.getMonth() === viewMonth &&
    selectedDate.getFullYear() === viewYear;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-full transition-colors hover:bg-[var(--surface-2)]"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-full transition-colors hover:bg-[var(--surface-2)]"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase py-1" style={{ color: 'var(--text-muted)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => (
            <div key={i} className="aspect-square flex items-center justify-center">
              {day !== null && (
                <button
                  disabled={isDisabled(day)}
                  onClick={() => {
                    if (!isDisabled(day)) onDateChange(new Date(viewYear, viewMonth, day));
                  }}
                  className={`w-full h-full text-xs font-semibold rounded-lg transition-all
                    ${isDisabled(day)
                      ? 'cursor-not-allowed opacity-30'
                      : isSelected(day)
                        ? 'text-white shadow-sm'
                        : 'hover:bg-[var(--surface-2)]'
                    }`}
                  style={isSelected(day) ? { background: 'var(--gradient-button)' } : { color: 'var(--text-primary)' }}
                  title={isClosed(day) && !isPast(day) ? 'Cerrado — no atendemos ese día' : undefined}
                >
                  {day}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
          Lun – Sáb · 8 AM – 7 PM · 24 h de anticipación
        </p>
      </div>

      {/* Time slots */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Franja horaria para el{' '}
              <span style={{ color: 'var(--brand-orange)' }}>
                {selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              :
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => onTimeChange(slot)}
                  className="text-xs font-semibold py-3 px-3 rounded-xl border transition-all text-center"
                  style={
                    selectedTime === slot
                      ? { background: 'var(--gradient-button)', color: '#fff', borderColor: 'transparent' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                  }
                >
                  {slot}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
