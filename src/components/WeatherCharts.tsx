import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
  Label,
} from 'recharts';
import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import type { Observation, Granularity } from '@/types/weather';
import { aggregateWindByBucket, formatShortDate, formatDayKey } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherChartsProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
  /** Ej: "Fuente: Open Data BCN - Estación: Gràcia" */
  dataSourceLabel?: string;
  stationName?: string;
}

export function WeatherCharts({ observations, granularity, isLoading, dataSourceLabel, stationName }: WeatherChartsProps) {
  const chartData = observations.map(obs => ({
    ...obs,
    label: formatShortDate(obs.timestamp),
  }));

  // Vista diaria: agrupar por día (registros horarios) para media ponderada temporal.
  // Vista horaria: un bucket por timestamp.
  const windBucketFn = granularity === 'daily' ? (obs: Observation) => formatDayKey(obs.timestamp) : (obs: Observation) => formatShortDate(obs.timestamp);
  const windChartData = aggregateWindByBucket(observations, windBucketFn).map(bucket => ({
    ...bucket,
    label: bucket.time,
  }));

  const lineCharts = [
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
  ];

  const totalLineCharts = lineCharts.length + 1; // sumamos la gráfica de viento
  const totalChartsWithBars = totalLineCharts + 1; // + precipitación

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(totalChartsWithBars)].map((_, i) => (
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
        <p className="text-muted-foreground text-sm">
          Selecciona una estación para ver los datos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dataSourceLabel && (
        <p className="text-xs text-muted-foreground">
          {dataSourceLabel}
        </p>
      )}
      {lineCharts.map((chart, index) => (
        <div 
          key={chart.dataKey} 
          className="chart-container animate-slide-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-2 mb-4">
            <chart.icon className={`h-5 w-5 ${chart.colorClass}`} />
            <h4 className="font-display font-semibold text-sm">{chart.title}</h4>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                unit={chart.unit}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number | null) => [
                  value !== null ? `${value}${chart.unit}` : 'Sin datos',
                  chart.title,
                ]}
              />
              <Line
                type="monotone"
                dataKey={chart.dataKey}
                stroke={chart.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
              {chartData.length > 20 && (
                <Brush 
                  dataKey="label" 
                  height={30} 
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--muted))"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      {/* Wind Speed Line Chart with min/avg/max */}
      <div 
        className="chart-container animate-slide-up"
        style={{ animationDelay: `${lineCharts.length * 100}ms` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Wind className="h-5 w-5 text-wind" />
          <h4 className="font-display font-semibold text-sm">Velocidad del viento</h4>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={windChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              unit="m/s"
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null, name) => [
                value !== null ? `${Number(value.toFixed(1))} m/s` : 'Sin datos',
                name,
              ]}
              itemSorter={(a, b) => {
                const order = ['Viento máx.', 'Viento media', 'Viento mín.'];
                return order.indexOf(String(a?.name ?? '')) - order.indexOf(String(b?.name ?? ''));
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              name="Viento máx."
              dataKey="windMax"
              stroke="hsl(160 55% 30%)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              name="Viento media"
              dataKey="windAvg"
              stroke="hsl(var(--chart-wind))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              name="Viento mín."
              dataKey="windMin"
              stroke="hsl(var(--chart-wind))"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              connectNulls
            />
            <ReferenceLine
              y={5}
              stroke="hsl(25 95% 50%)"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={
                <Label
                  value="Límite mediciones acústicas (5 m/s)"
                  position="top"
                  fill="hsl(25 95% 50%)"
                  fontSize={11}
                />
              }
            />
            {windChartData.length > 20 && (
              <Brush 
                dataKey="label" 
                height={30} 
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Precipitation Bar Chart */}
      <div 
        className="chart-container animate-slide-up"
        style={{ animationDelay: `${(totalChartsWithBars - 1) * 100}ms` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CloudRain className="h-5 w-5 text-primary" />
          <h4 className="font-display font-semibold text-sm">Precipitación</h4>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              unit="mm"
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null) => [
                value !== null ? `${value} mm` : 'Sin datos',
                'Precipitación',
              ]}
            />
            <Bar
              dataKey="precipitation"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
            {chartData.length > 20 && (
              <Brush 
                dataKey="label" 
                height={30} 
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
