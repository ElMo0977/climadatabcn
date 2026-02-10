import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DateRange, Granularity } from '@/types/weather';
import { cn } from '@/lib/utils';
import { QUICK_RANGE_PRESETS, buildQuickRangeExcludingToday, getActiveQuickRangeKey } from '@/lib/quickDateRanges';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  granularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  granularity,
  onGranularityChange,
}: DateRangePickerProps) {
  const activePreset = getActiveQuickRangeKey(dateRange);

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
                'station-item !mb-0 !rounded-md !px-2 !py-1 !text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
              onSelect={(date) => date && onDateRangeChange({ ...dateRange, from: date })}
              disabled={(date) => date > new Date() || date > dateRange.to}
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
              onSelect={(date) => date && onDateRangeChange({ ...dateRange, to: date })}
              disabled={(date) => date > new Date() || date < dateRange.from}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Vista</span>
        </div>
        <Tabs value={granularity} onValueChange={(v) => onGranularityChange(v as Granularity)}>
          <TabsList className="h-8">
            <TabsTrigger value="30min" className="text-xs px-3 h-6">Por horas</TabsTrigger>
            <TabsTrigger value="daily" className="text-xs px-3 h-6">Diario</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {show30minWarning && (
        <p className="text-xs text-destructive">
          Máximo 31 días para datos de detalle. Reduce el rango.
        </p>
      )}
    </div>
  );
}
