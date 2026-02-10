import { Thermometer, Droplets, Wind, BarChart3, CloudRain } from 'lucide-react';
import type { WeatherStats } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WeatherKPIsProps {
  stats: WeatherStats | null;
  isLoading: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function WeatherKPIs({ stats, isLoading }: WeatherKPIsProps) {
  const avgTemperature = stats?.avgTemperature;
  const avgHumidity = stats?.avgHumidity;
  const avgWindSpeed = stats?.avgWindSpeed;
  const maxWindSpeed = stats?.maxWindSpeed;
  const totalPrecipitation = stats?.totalPrecipitation;
  const dataPoints =
    typeof stats?.dataPoints === 'number' && Number.isFinite(stats.dataPoints)
      ? stats.dataPoints
      : 0;

  const windValue = isFiniteNumber(avgWindSpeed) && isFiniteNumber(maxWindSpeed)
    ? `${avgWindSpeed} / ${maxWindSpeed} m/s`
    : isFiniteNumber(avgWindSpeed)
      ? `${avgWindSpeed} m/s`
      : '—';

  const kpis = [
    {
      label: 'Temperatura media',
      value: isFiniteNumber(avgTemperature) ? `${avgTemperature}°C` : '—',
      icon: Thermometer,
      colorClass: 'text-temperature',
      bgClass: 'bg-temperature/10',
    },
    {
      label: 'Humedad media',
      value: isFiniteNumber(avgHumidity) ? `${avgHumidity}%` : '—',
      icon: Droplets,
      colorClass: 'text-humidity',
      bgClass: 'bg-humidity/10',
    },
    {
      label: 'Viento media / racha',
      value: windValue,
      icon: Wind,
      colorClass: 'text-wind',
      bgClass: 'bg-wind/10',
    },
    {
      label: 'Precipitación total',
      value: isFiniteNumber(totalPrecipitation) ? `${totalPrecipitation} mm` : '—',
      icon: CloudRain,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'Datos',
      value: dataPoints,
      icon: BarChart3,
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted/50',
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}
