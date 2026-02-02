import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DateRange, Granularity } from '@/types/weather';
import { cn } from '@/lib/utils';

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
  const presets = [
    { label: '7 días', days: 7 },
    { label: '14 días', days: 14 },
    { label: '30 días', days: 30 },
  ];

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = subDays(to, days - 1);
    onDateRangeChange({ from, to });
  };

  // Calculate days in range
  const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const showHourlyWarning = granularity === 'hourly' && daysDiff > 31;

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Rango de fechas</h3>
        <div className="flex gap-1">
          {presets.map(preset => (
            <Button
              key={preset.days}
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
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
          <span>Granularidad</span>
        </div>
        <Tabs value={granularity} onValueChange={(v) => onGranularityChange(v as Granularity)}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs px-3 h-6">Diario</TabsTrigger>
            <TabsTrigger value="hourly" className="text-xs px-3 h-6">Horario</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {showHourlyWarning && (
        <p className="text-xs text-destructive">
          Máximo 31 días para datos horarios. Reduce el rango.
        </p>
      )}
    </div>
  );
}
