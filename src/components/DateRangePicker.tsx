import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange, Granularity } from '@/types/weather';
import { cn } from '@/lib/utils';
import { QUICK_RANGE_PRESETS, buildQuickRangeExcludingToday, getActiveQuickRangeKey } from '@/lib/quickDateRanges';

const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  granularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
  fromTime?: string | null;
  toTime?: string | null;
  onTimeRangeChange?: (fromTime: string | null, toTime: string | null) => void;
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  granularity,
  onGranularityChange,
  fromTime,
  toTime,
  onTimeRangeChange,
}: DateRangePickerProps) {
  const selectableButtonClass =
    'station-item !mb-0 !rounded-md !px-2 !py-1 !text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  const activePreset = getActiveQuickRangeKey(dateRange);
  const maxSelectableDate = endOfDay(buildQuickRangeExcludingToday(1).to);

  const applyPreset = (days: number) => {
    onDateRangeChange(buildQuickRangeExcludingToday(days));
  };

  const daysDiff = Math.floor(
    (startOfDay(dateRange.to).getTime() - startOfDay(dateRange.from).getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;
  const show30minWarning = granularity === '30min' && daysDiff > 31;

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-sm">Rango de fechas</h3>
        <div className="ml-2 flex gap-1">
          {QUICK_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.days)}
              className={cn(
                selectableButtonClass,
                activePreset === preset.key && 'active',
              )}
              aria-pressed={activePreset === preset.key}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? format(dateRange.from, "d MMM yyyy", { locale: es }) : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.from}
              onSelect={(date) => date && onDateRangeChange({ ...dateRange, from: startOfDay(date) })}
              disabled={(date) => date > maxSelectableDate || date > endOfDay(dateRange.to)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !dateRange.to && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.to ? format(dateRange.to, "d MMM yyyy", { locale: es }) : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.to}
              onSelect={(date) => date && onDateRangeChange({ ...dateRange, to: endOfDay(date) })}
              disabled={(date) => date > maxSelectableDate || date < startOfDay(dateRange.from)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Vista</span>
        </div>
        <div className="ml-2 flex gap-1" role="group" aria-label="Granularidad temporal">
          <button
            type="button"
            onClick={() => onGranularityChange('30min')}
            className={cn(selectableButtonClass, granularity === '30min' && 'active')}
            aria-pressed={granularity === '30min'}
          >
            Datos 30 min
          </button>
          <button
            type="button"
            onClick={() => onGranularityChange('daily')}
            className={cn(selectableButtonClass, granularity === 'daily' && 'active')}
            aria-pressed={granularity === 'daily'}
          >
            Diario
          </button>
        </div>
      </div>

      {show30minWarning && (
        <p className="text-xs text-destructive">
          Máximo 31 días para datos de detalle. Reduce el rango.
        </p>
      )}

      {granularity === '30min' && onTimeRangeChange && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Franja horaria</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={fromTime ?? '00:00'}
              onChange={(e) => onTimeRangeChange(e.target.value === '00:00' ? null : e.target.value, toTime ?? null)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {HALF_HOUR_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground shrink-0">hasta</span>
            <select
              value={toTime ?? '23:30'}
              onChange={(e) => onTimeRangeChange(fromTime ?? null, e.target.value === '23:30' ? null : e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {HALF_HOUR_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
            {(fromTime || toTime) && (
              <button
                type="button"
                onClick={() => onTimeRangeChange(null, null)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                title="Limpiar franja horaria"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
