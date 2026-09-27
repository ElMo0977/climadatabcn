import { Thermometer, Droplets, Wind, BarChart3, CloudRain } from 'lucide-react';
import type { Granularity, Observation, WeatherStats } from '@/types/weather';
import type { DailyQuality, DailyQualityVariable } from '@/lib/dailyQuality';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getWindKpiDisplay } from '@/lib/windKpi';
import { isFiniteNumber } from '@/lib/weatherUtils';

interface WeatherKPIsProps {
  stats: WeatherStats | null;
  isLoading: boolean;
  granularity?: Granularity;
  dailyQualityByDay?: Record<string, DailyQuality> | null;
  observations?: Observation[];
}

function dailyProvenance(days: DailyQuality[], observations: Observation[], variable: DailyQualityVariable, label: string): string {
  const observationsByDay = new Map(observations.map((observation) => [observation.timestamp.slice(0, 10), observation]));
  const excluded = days.filter((day) => !['complete', 'partial'].includes(day.variables[variable].status)).length;
  const usable = days.filter((day) => ['complete', 'partial'].includes(day.variables[variable].status)
    && isFiniteNumber(observationsByDay.get(day.dayKey)?.[variable])).length;
  const withoutValue = days.length - excluded - usable;
  return `${label}: ${usable} de ${days.length} ${days.length === 1 ? 'día' : 'días'} con valor utilizable; ${excluded} excluido${excluded === 1 ? '' : 's'} por cobertura; ${withoutValue} sin valor`;
}

export function WeatherKPIs({ stats, isLoading, granularity, dailyQualityByDay, observations = [] }: WeatherKPIsProps) {
  const avgTemperature = stats?.avgTemperature;
  const avgHumidity = stats?.avgHumidity;
  const avgWindSpeed = stats?.avgWindSpeed;
  const maxWindSpeed = stats?.maxWindSpeed;
  const totalPrecipitation = stats?.totalPrecipitation;
  const dataPoints =
    typeof stats?.dataPoints === 'number' && Number.isFinite(stats.dataPoints)
      ? stats.dataPoints
      : 0;

  const windKpi = getWindKpiDisplay(avgWindSpeed, maxWindSpeed);
  const dailyDays = granularity === 'daily' ? Object.values(dailyQualityByDay ?? {}) : [];
  const showDailyProvenance = granularity === 'daily' && dailyDays.length > 0;
  const observationsByDay = new Map(observations.map((observation) => [observation.timestamp.slice(0, 10), observation]));
  const hasPartialLowerBound = (variable: 'precipitation' | 'windSpeedMax') =>
    dailyDays.some((day) => day.variables[variable].status === 'partial'
      && day.variables[variable].isObservedLowerBound
      && isFiniteNumber(observationsByDay.get(day.dayKey)?.[variable]));

  const kpis = [
    {
      label: 'Temperatura media',
      value: isFiniteNumber(avgTemperature) ? `${avgTemperature}°C` : '—',
      icon: Thermometer,
      colorClass: 'text-temperature',
      bgClass: 'bg-temperature/10',
      provenance: ['temperature'] as DailyQualityVariable[],
      provenanceLabels: ['Temperatura'],
    },
    {
      label: 'Humedad media',
      value: isFiniteNumber(avgHumidity) ? `${avgHumidity}%` : '—',
      icon: Droplets,
      colorClass: 'text-humidity',
      bgClass: 'bg-humidity/10',
      provenance: ['humidity'] as DailyQualityVariable[],
      provenanceLabels: ['Humedad'],
    },
    {
      label: windKpi.label,
      value: windKpi.value,
      icon: Wind,
      colorClass: 'text-wind',
      bgClass: 'bg-wind/10',
      provenance: ['windSpeed', 'windSpeedMax'] as DailyQualityVariable[],
      provenanceLabels: ['Viento medio', 'Racha máxima'],
    },
    {
      label: granularity === 'daily' ? 'Precipitación observada' : 'Precipitación total',
      value: isFiniteNumber(totalPrecipitation) ? `${totalPrecipitation} mm` : '—',
      icon: CloudRain,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
      provenance: ['precipitation'] as DailyQualityVariable[],
      provenanceLabels: ['Precipitación'],
    },
    {
      label: 'Datos',
      value: dataPoints,
      icon: BarChart3,
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted/50',
      provenance: [] as DailyQualityVariable[],
      provenanceLabels: [],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {kpis.map((kpi, index) => (
        <div key={kpi.label} className="kpi-card animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg", kpi.bgClass)}>
                  <kpi.icon className={cn("h-4 w-4", kpi.colorClass)} />
                </div>
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={cn("text-2xl font-display font-bold", kpi.colorClass)}>
                {kpi.value}
              </p>
              {showDailyProvenance && kpi.provenance.map((variable, index) => (
                <p key={variable} className="mt-1 text-xs text-muted-foreground">
                  {dailyProvenance(dailyDays, observations, variable, kpi.provenanceLabels[index])}
                </p>
              ))}
              {showDailyProvenance && kpi.provenance.includes('precipitation')
                && isFiniteNumber(totalPrecipitation) && hasPartialLowerBound('precipitation') && (
                  <p className="mt-1 text-xs text-muted-foreground">Precipitación: mínimo observado en días parciales</p>
                )}
              {showDailyProvenance && kpi.provenance.includes('windSpeedMax')
                && isFiniteNumber(maxWindSpeed) && hasPartialLowerBound('windSpeedMax') && (
                  <p className="mt-1 text-xs text-muted-foreground">Racha máxima: mínimo observado en días parciales</p>
                )}
              {showDailyProvenance && kpi.label === 'Datos' && (
                <p className="mt-1 text-xs text-muted-foreground">Datos: {dataPoints} filas con lecturas</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
