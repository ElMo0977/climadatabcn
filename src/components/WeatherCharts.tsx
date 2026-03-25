import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import type { Observation, Granularity } from '@/types/weather';
import { aggregateWindByBucket, formatShortDate, formatDayKey } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherChartsProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
  dataSourceLabel?: string;
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

export function WeatherCharts({ observations, granularity, isLoading, dataSourceLabel }: WeatherChartsProps) {
  const formatObservationLabel = granularity === 'daily' ? formatDayKey : formatShortDate;

  const chartData = useMemo(
    () =>
      observations.map((observation) => ({
        ...observation,
        label: formatObservationLabel(observation.timestamp),
      })),
    [formatObservationLabel, observations],
  );

  const windChartData = useMemo(
    () =>
      aggregateWindByBucket(observations, (observation) => formatObservationLabel(observation.timestamp)).map(
        (bucket) => ({
          ...bucket,
          label: bucket.time,
        }),
      ),
    [formatObservationLabel, observations],
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

  if (observations.length === 0) {
    return (
      <div className="chart-container flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Selecciona una estación para ver los datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dataSourceLabel && <p className="text-xs text-muted-foreground">{dataSourceLabel}</p>}

      {LINE_CHARTS.map((chart, index) => (
        <div key={chart.dataKey} className="chart-container animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
          <div className="flex items-center gap-2 mb-4">
            <chart.icon className={`h-5 w-5 ${chart.colorClass}`} />
            <h4 className="font-display font-semibold text-sm">{chart.title}</h4>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit={chart.unit} width={50} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number | null) => [value !== null ? `${value}${chart.unit}` : 'Sin datos', chart.title]}
              />
              <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color} strokeWidth={LINE_STROKE_WIDTH} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls />
              {dayBoundaryLabels.map((lbl) => (
                <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              ))}
              {chartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      {/* Wind Chart */}
      <div className="chart-container animate-slide-up" style={{ animationDelay: `${LINE_CHARTS.length * 100}ms` }}>
        <div className="flex items-center gap-2 mb-4">
          <Wind className="h-5 w-5 text-wind" />
          <h4 className="font-display font-semibold text-sm">Velocidad del viento</h4>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={windChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit="m/s" width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null, name: string) => [value !== null ? `${Number(Number(value).toFixed(1))} m/s` : 'Sin datos', name]}
              itemSorter={(a: { name?: string }, b: { name?: string }) => {
                const order = ['Racha máx.', 'Viento media'];
                return order.indexOf(String(a?.name ?? '')) - order.indexOf(String(b?.name ?? ''));
              }}
            />
            <Line type="monotone" name="Racha máx." dataKey="windMax" stroke="hsl(160 55% 30%)" strokeWidth={WIND_GUST_STROKE_WIDTH} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls />
            <Line type="monotone" name="Viento media" dataKey="windAvg" stroke="hsl(var(--chart-wind))" strokeWidth={LINE_STROKE_WIDTH} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} connectNulls />
            <ReferenceLine y={WIND_THRESHOLD} stroke="hsl(25 95% 50%)" strokeDasharray="5 5" strokeWidth={LINE_STROKE_WIDTH} />
            {dayBoundaryLabels.map((lbl) => (
              <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            ))}
            {windChartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
          </LineChart>
        </ResponsiveContainer>
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
      <div className="chart-container animate-slide-up" style={{ animationDelay: `${(LINE_CHARTS.length + 1) * 100}ms` }}>
        <div className="flex items-center gap-2 mb-4">
          <CloudRain className="h-5 w-5 text-primary" />
          <h4 className="font-display font-semibold text-sm">Precipitación</h4>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={granularity === 'daily'} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} unit="mm" width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null) => [value !== null ? `${value} mm` : 'Sin datos', 'Precipitación']}
            />
            <Bar dataKey="precipitation" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            {dayBoundaryLabels.map((lbl) => (
              <ReferenceLine key={lbl} x={lbl} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            ))}
            {chartData.length > 20 && <Brush dataKey="label" height={30} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
