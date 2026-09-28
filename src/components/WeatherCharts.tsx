import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { Thermometer, Droplets, Wind, CloudRain, Download } from 'lucide-react';
import type { Observation, Granularity } from '@/types/weather';
import type { DailyQuality, DailyQualityVariable, VariableDailyQuality } from '@/lib/dailyQuality';
import { aggregateWindByBucket, formatShortDate, formatDayKey } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { exportChartAsPng, exportChartAsPdf } from '@/lib/exportChart';
import { CoverageMark, ValidationMark } from './QualityMarks';

interface WeatherChartsProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
  dataSourceLabel?: string;
  dailyQualityByDay?: Record<string, DailyQuality> | null;
}

const DAILY_VARIABLE_LABELS: Record<DailyQualityVariable, string> = {
  temperature: 'Temperatura', humidity: 'Humedad', windSpeed: 'Viento medio',
  windSpeedMax: 'Racha máxima', precipitation: 'Precipitación',
};
const COVERAGE_LABELS: Record<VariableDailyQuality['status'], string> = {
  complete: 'completo', partial: 'parcial', incomplete: 'incompleto', missing: 'ausente',
};
const VALIDATION_LABELS: Record<VariableDailyQuality['validationStatus'], string> = {
  valid: 'validada', pending: 'pendiente', 'not-started': 'no iniciada',
  unknown: 'desconocida', unreported: 'no informada', mixed: 'mixta',
};

function usableValue(value: number | null | undefined, quality?: VariableDailyQuality): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (quality && quality.status !== 'complete' && quality.status !== 'partial') return null;
  return value;
}

function qualityDetail(dayKey: string, variable: DailyQualityVariable, quality: DailyQuality): string {
  const item = quality.variables[variable];
  const status = COVERAGE_LABELS[item.status];
  const lowerBound = item.status === 'partial' && item.isObservedLowerBound ? '; mínimo observado' : '';
  return `${DAILY_VARIABLE_LABELS[variable]} ${dayKey}: ${item.coveredSlots}/${quality.expectedSlots} franjas, ${status}${lowerBound}`;
}

function chartTooltipValue(value: number | null, unit: string, variable: DailyQualityVariable,
  dayKey: string | undefined, dailyQualityByDay?: Record<string, DailyQuality> | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Sin datos';
  const quality = dayKey ? dailyQualityByDay?.[dayKey] : undefined;
  if (!quality) return `${value}${unit}`;
  const item = quality.variables[variable];
  const lowerBound = item.status === 'partial' && item.isObservedLowerBound;
  const validation = Object.values(item.validationCounts).some((count) => count > 0)
    && item.validationStatus !== 'valid' ? `; validación XEMA ${VALIDATION_LABELS[item.validationStatus]}` : '';
  return `${lowerBound ? '≥' : ''}${value}${unit} · ${item.coveredSlots}/${quality.expectedSlots} franjas, ${COVERAGE_LABELS[item.status]}${validation}`;
}

function ChartQualityNotes({ days, variables, observationsByDay, dailyQualityByDay }: {
  days: string[];
  variables: DailyQualityVariable[];
  observationsByDay: Map<string, Observation>;
  dailyQualityByDay?: Record<string, DailyQuality> | null;
}) {
  if (!dailyQualityByDay) return null;
  return <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Incidencias de calidad en la gráfica">
    {days.flatMap((dayKey) => variables.flatMap((variable) => {
      const quality = dailyQualityByDay[dayKey];
      if (!quality) return [];
      const item = quality.variables[variable];
      const value = observationsByDay.get(dayKey)?.[variable];
      const numeric = typeof value === 'number' && Number.isFinite(value);
      const issue = item.status !== 'complete' || !numeric;
      const unconfirmed = Object.values(item.validationCounts).some((count) => count > 0)
        && item.validationStatus !== 'valid';
      if (!issue && !unconfirmed) return [];
      const detail = qualityDetail(dayKey, variable, quality);
      const missingValueDetail = !numeric ? `${detail}; sin valor diario utilizable` : detail;
      const lowerBound = numeric && item.status === 'partial' && item.isObservedLowerBound;
      return [<span key={`${dayKey}-${variable}`} className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <span>{dayKey}{variables.length > 1 ? ` · ${DAILY_VARIABLE_LABELS[variable]}` : ''}</span>
        {issue && <CoverageMark status={numeric ? item.status : 'missing-reading'}
          ariaLabel={missingValueDetail} />}
        {unconfirmed && <ValidationMark status={item.validationStatus}
          detail={`${DAILY_VARIABLE_LABELS[variable]} ${dayKey}: Validación XEMA ${VALIDATION_LABELS[item.validationStatus]}`} />}
        {lowerBound && <span title="Mínimo observado">≥{value}</span>}
      </span>];
    }))}
  </div>;
}

const LINE_CHARTS = [
  {
    title: 'Temperatura',
    icon: Thermometer,
    dataKey: 'temperature',
    color: 'hsl(var(--chart-temp))',
    unit: '°C',
    colorClass: 'text-temperature',
  },
  {
    title: 'Humedad',
    icon: Droplets,
    dataKey: 'humidity',
    color: 'hsl(var(--chart-humidity))',
    unit: '%',
    colorClass: 'text-humidity',
  },
] as const;

const LINE_STROKE_WIDTH = 1.5;
const WIND_GUST_STROKE_WIDTH = 2;
const WIND_THRESHOLD = 5;
const WIND_THRESHOLD_LABEL = 'Límite 5 m/s';

const WIND_LEGEND_ITEMS = [
  {
    label: 'Racha máx.',
    color: 'hsl(160 55% 30%)',
    strokeWidth: WIND_GUST_STROKE_WIDTH,
    dashed: false,
  },
  {
    label: 'Viento media',
    color: 'hsl(var(--chart-wind))',
    strokeWidth: LINE_STROKE_WIDTH,
    dashed: false,
  },
  {
    label: WIND_THRESHOLD_LABEL,
    color: 'hsl(25 95% 50%)',
    strokeWidth: LINE_STROKE_WIDTH,
    dashed: true,
  },
] as const;

function ChartExportMenu({ chartRef, title }: { chartRef: RefObject<HTMLDivElement>; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const slug = title.toLowerCase().replace(/\s+/g, '-');

  const run = async (fn: (el: HTMLElement, name: string) => Promise<void>) => {
    if (!chartRef.current || busy) return;
    setBusy(true);
    setOpen(false);
    try {
      await fn(chartRef.current, `grafico-${slug}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={busy}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        title="Descargar gráfico"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div ref={menuRef} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-5 z-10 min-w-[110px] rounded-md border border-border bg-card shadow-md text-xs overflow-hidden">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => void run(exportChartAsPng)}
          >
            PNG
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => void run(exportChartAsPdf)}
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

export function WeatherCharts({ observations, granularity, isLoading, dataSourceLabel, dailyQualityByDay }: WeatherChartsProps) {
  const tempRef = useRef<HTMLDivElement>(null);
  const humRef = useRef<HTMLDivElement>(null);
  const windRef = useRef<HTMLDivElement>(null);
  const rainRef = useRef<HTMLDivElement>(null);

  const formatObservationLabel = granularity === 'daily' ? formatDayKey : formatShortDate;
  const isDaily = granularity === 'daily';
  const observationsByDay = useMemo(() => new Map(observations.map((observation) => [
    observation.timestamp.slice(0, 10), observation,
  ])), [observations]);
  const chartDays = useMemo(() => isDaily
    ? [...new Set([...Object.keys(dailyQualityByDay ?? {}), ...observationsByDay.keys()])].sort()
    : [], [isDaily, dailyQualityByDay, observationsByDay]);

  const chartData = useMemo(
    () => isDaily && dailyQualityByDay
      ? chartDays.map((dayKey) => {
        const observation = observationsByDay.get(dayKey);
        const quality = dailyQualityByDay[dayKey];
        return {
          dayKey, label: formatDayKey(dayKey),
          temperature: usableValue(observation?.temperature, quality?.variables.temperature),
          humidity: usableValue(observation?.humidity, quality?.variables.humidity),
          windAvg: usableValue(observation?.windSpeed, quality?.variables.windSpeed),
          windMax: usableValue(observation?.windSpeedMax, quality?.variables.windSpeedMax),
          precipitation: usableValue(observation?.precipitation, quality?.variables.precipitation),
        };
      })
      : observations.map((observation) => ({
        ...observation,
        label: formatObservationLabel(observation.timestamp),
      })),
    [chartDays, dailyQualityByDay, formatObservationLabel, isDaily, observations, observationsByDay],
  );

  const windChartData = useMemo(
    () => isDaily && dailyQualityByDay ? chartData :
      aggregateWindByBucket(observations, (observation) => formatObservationLabel(observation.timestamp)).map(
        (bucket) => ({
          ...bucket,
          label: bucket.time,
        }),
      ),
    [chartData, dailyQualityByDay, formatObservationLabel, isDaily, observations],
  );

  // Vertical grid lines at day boundaries (only needed for 30min — one line per calendar day)
  const dayBoundaryLabels = useMemo((): string[] => {
    if (granularity !== '30min' || observations.length === 0) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const obs of observations) {
      const dayKey = obs.timestamp.slice(0, 10);
      if (!seen.has(dayKey)) {
        seen.add(dayKey);
        result.push(formatObservationLabel(obs.timestamp));
      }
    }
    return result;
  }, [granularity, observations, formatObservationLabel]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="chart-container">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (observations.length === 0 && (!isDaily || chartDays.length === 0)) {
    return (
      <div className="chart-container flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Selecciona una estación para ver los datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dataSourceLabel && <p className="text-xs text-muted-foreground">{dataSourceLabel}</p>}

      {LINE_CHARTS.map((chart, index) => {
        const ref = index === 0 ? tempRef : humRef;
        return (
        <div key={chart.dataKey} ref={ref} className="chart-container animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <chart.icon className={`h-5 w-5 ${chart.colorClass}`} />
              <h4 className="font-display font-semibold text-sm">{chart.title}</h4>
            </div>
            <ChartExportMenu chartRef={ref} title={chart.title} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit={chart.unit} width={50} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number | null, _name: string, item: { payload?: { dayKey?: string } }) => [chartTooltipValue(value, chart.unit,
                  chart.dataKey, item.payload?.dayKey, isDaily ? dailyQualityByDay : null), chart.title]}
              />
              <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color} strokeWidth={LINE_STROKE_WIDTH} dot={isDaily} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls={!isDaily} />
              {dayBoundaryLabels.map((lbl) => (
                <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              ))}
              {chartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
            </LineChart>
          </ResponsiveContainer>
          {isDaily && <ChartQualityNotes days={chartDays} variables={[chart.dataKey]}
            observationsByDay={observationsByDay} dailyQualityByDay={dailyQualityByDay} />}
        </div>
        );
      })}

      {/* Wind Chart */}
      <div ref={windRef} className="chart-container animate-slide-up" style={{ animationDelay: `${LINE_CHARTS.length * 100}ms` }}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-wind" />
            <h4 className="font-display font-semibold text-sm">Velocidad del viento</h4>
          </div>
          <ChartExportMenu chartRef={windRef} title="Velocidad del viento" />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={windChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit="m/s" width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null, name: string, item: { payload?: { dayKey?: string } }) => [chartTooltipValue(
                typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(1)) : null, ' m/s',
                name === 'Racha máx.' ? 'windSpeedMax' : 'windSpeed',
                item.payload?.dayKey, isDaily ? dailyQualityByDay : null), name]}
              itemSorter={(a: { name?: string }, b: { name?: string }) => {
                const order = ['Racha máx.', 'Viento media'];
                return order.indexOf(String(a?.name ?? '')) - order.indexOf(String(b?.name ?? ''));
              }}
            />
            <Line type="monotone" name="Racha máx." dataKey="windMax" stroke="hsl(160 55% 30%)" strokeWidth={WIND_GUST_STROKE_WIDTH} dot={isDaily} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls={!isDaily} />
            <Line type="monotone" name="Viento media" dataKey="windAvg" stroke="hsl(var(--chart-wind))" strokeWidth={LINE_STROKE_WIDTH} dot={isDaily} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls={!isDaily} />
            <ReferenceLine y={WIND_THRESHOLD} stroke="hsl(25 95% 50%)" strokeDasharray="5 5" strokeWidth={LINE_STROKE_WIDTH} />
            {dayBoundaryLabels.map((lbl) => (
              <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            ))}
            {windChartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
          </LineChart>
        </ResponsiveContainer>
        {isDaily && <ChartQualityNotes days={chartDays} variables={['windSpeed', 'windSpeedMax']}
          observationsByDay={observationsByDay} dailyQualityByDay={dailyQualityByDay} />}
        <div aria-label="Leyenda de viento" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {WIND_LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block w-6 shrink-0"
                style={{
                  borderTopColor: item.color,
                  borderTopStyle: item.dashed ? 'dashed' : 'solid',
                  borderTopWidth: `${item.strokeWidth}px`,
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Precipitation */}
      <div ref={rainRef} className="chart-container animate-slide-up" style={{ animationDelay: `${(LINE_CHARTS.length + 1) * 100}ms` }}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CloudRain className="h-5 w-5 text-primary" />
            <h4 className="font-display font-semibold text-sm">Precipitación</h4>
          </div>
          <ChartExportMenu chartRef={rainRef} title="Precipitacion" />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit="mm" width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null, _name: string, item: { payload?: { dayKey?: string } }) => [chartTooltipValue(value, ' mm',
                'precipitation', item.payload?.dayKey, isDaily ? dailyQualityByDay : null), 'Precipitación']}
            />
            <Bar dataKey="precipitation" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            {dayBoundaryLabels.map((lbl) => (
              <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            ))}
            {chartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
          </BarChart>
        </ResponsiveContainer>
        {isDaily && <ChartQualityNotes days={chartDays} variables={['precipitation']}
          observationsByDay={observationsByDay} dailyQualityByDay={dailyQualityByDay} />}
      </div>
    </div>
  );
}
