import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Observation, Granularity, ObservationVariable } from '@/types/weather';
import type { DailyQuality, DailyQualityVariable, VariableDailyQuality } from '@/lib/dailyQuality';
import { formatTimestamp, formatDayLabel, isFiniteNumber } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { CoverageMark, ValidationMark } from './QualityMarks';

interface DataTableProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
  dailyQualityByDay?: Record<string, DailyQuality> | null;
}

const PAGE_SIZE = 20;
const WIND_LIMIT_ACOUSTIC = 5;

function DetailValue({ observation, variable, value, className = 'text-right tabular-nums' }: {
  observation: Observation;
  variable: ObservationVariable;
  value: number | string | null;
  className?: string;
}) {
  const missing = value === null || (typeof value === 'number' && !isFiniteNumber(value));
  return <TableCell className={className}>
    <span>{missing ? '—' : value}</span>
    {missing ? <CoverageMark status="missing-reading" />
      : <ValidationMark status={observation.variableMetadata?.[variable]?.validationStatus ?? 'unreported'} />}
  </TableCell>;
}

function DailyValue({ value, quality, expectedSlots, lowerBound = false, className = 'text-right tabular-nums' }: {
  value: number | string | null | undefined;
  quality?: VariableDailyQuality;
  expectedSlots?: number;
  lowerBound?: boolean;
  className?: string;
}) {
  const displayValue = typeof value === 'number' && !isFiniteNumber(value) ? null : value;
  const isLowerBound = isFiniteNumber(displayValue) && lowerBound && quality?.isObservedLowerBound;
  return (
    <TableCell className={className}>
      <span>{isLowerBound ? `≥ ${displayValue}` : displayValue ?? '—'}</span>
      {quality && quality.status !== 'complete' && expectedSlots !== undefined && (
        <span className="block text-xs text-muted-foreground font-normal whitespace-nowrap">
          <CoverageMark status={quality.status} detail={`${quality.coveredSlots}/${expectedSlots} franjas`} />
          {quality.status === 'partial' ? 'Parcial' : quality.status === 'missing' ? 'Sin dato' : 'Incompleto'} · {quality.coveredSlots}/{expectedSlots} franjas
          {(quality.status === 'incomplete' || quality.status === 'missing') && ' · Excluido de KPI'}
        </span>
      )}
      {quality && quality.validationStatus !== 'valid'
        && Object.values(quality.validationCounts).some((count) => count > 0) && (
        <span className="block text-xs text-muted-foreground font-normal">
          <ValidationMark status={quality.validationStatus} />
          Validación XEMA: {quality.validationStatus === 'pending' ? 'pendiente'
            : quality.validationStatus === 'not-started' ? 'no iniciada'
              : quality.validationStatus === 'unknown' ? 'desconocida'
                : quality.validationStatus === 'mixed' ? 'mixta' : 'no informada'}
        </span>
      )}
      {isLowerBound && <span className="block text-xs text-muted-foreground font-normal">Mínimo observado</span>}
    </TableCell>
  );
}

export function DataTable({ observations, granularity, isLoading, dailyQualityByDay }: DataTableProps) {
  const [page, setPage] = useState(0);

  const isDetail = granularity === '30min';
  const qualityDays = !isDetail && dailyQualityByDay ? Object.keys(dailyQualityByDay) : [];
  const observationByDay = new Map(observations.map((observation) => [observation.timestamp.slice(0, 10), observation]));
  const tableDays = qualityDays.length > 0
    ? [...new Set([...qualityDays, ...observationByDay.keys()])].sort()
    : observations.map((observation) => observation.timestamp.slice(0, 10));
  const rowCount = isDetail ? observations.length : tableDays.length;

  useEffect(() => {
    setPage(0);
  }, [granularity, observations, dailyQualityByDay]);

  const totalPages = Math.ceil(rowCount / PAGE_SIZE) || 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const paginatedData = observations.slice(startIndex, startIndex + PAGE_SIZE);
  const paginatedDays = tableDays.slice(startIndex, startIndex + PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border"><Skeleton className="h-5 w-32" /></div>
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  if (rowCount === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
      </div>
    );
  }

  const roundWind = (v: number | null) => v !== null ? Math.round(v * 10) / 10 : '—';
  const windCellClass = (value: number | null) =>
    value !== null && value > WIND_LIMIT_ACOUSTIC
      ? 'text-right tabular-nums bg-orange-100 dark:bg-orange-950/50 font-bold'
      : 'text-right tabular-nums';

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h4 className="font-display font-semibold text-sm">
          {isDetail ? 'Datos 30 min' : 'Resumen diario'}
        </h4>
        <span className="text-xs text-muted-foreground">
          {rowCount} {isDetail ? 'registros' : 'días seleccionados'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isDetail ? (
                <>
                  <TableHead className="font-semibold">Fecha/Hora</TableHead>
                  <TableHead className="font-semibold text-right">Temperatura (°C)</TableHead>
                  <TableHead className="font-semibold text-right">Humedad relativa (%)</TableHead>
                  <TableHead className="font-semibold text-right">Viento medio 10 m (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Dirección del viento 10 m (°)</TableHead>
                  <TableHead className="font-semibold text-right">Racha máxima 10 m (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Precipitación (mm)</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold text-right">Temperatura media (°C)</TableHead>
                  <TableHead className="font-semibold text-right">Humedad relativa media (%)</TableHead>
                  <TableHead className="font-semibold text-right">Viento medio 10 m (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Racha máxima 10 m (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Hora de racha máxima</TableHead>
                  <TableHead className="font-semibold text-right">Precipitación (mm)</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isDetail ? paginatedData.map((obs, index) => (
              <TableRow key={`${obs.timestamp}-${index}`}>
                <TableCell className="font-medium">{formatTimestamp(obs.timestamp, true)}</TableCell>
                <DetailValue observation={obs} variable="temperature" value={obs.temperature} />
                <DetailValue observation={obs} variable="humidity" value={obs.humidity} />
                <DetailValue observation={obs} variable="windSpeed" value={obs.windSpeed == null ? null : roundWind(obs.windSpeed)} className={windCellClass(obs.windSpeed)} />
                <DetailValue observation={obs} variable="windDirection" value={obs.windDirection} />
                <DetailValue observation={obs} variable="windSpeedMax" value={obs.windSpeedMax == null ? null : roundWind(obs.windSpeedMax)} className={windCellClass(obs.windSpeedMax)} />
                <DetailValue observation={obs} variable="precipitation" value={obs.precipitation} />
              </TableRow>
            )) : paginatedDays.map((dayKey) => {
              const obs = observationByDay.get(dayKey);
              const dailyQuality = dailyQualityByDay?.[dayKey];
              const variableQuality = (variable: DailyQualityVariable) => dailyQuality?.variables[variable];
              return (
                <TableRow key={dayKey}>
                  <TableCell className="font-medium">
                    {formatDayLabel(dayKey)}
                    {!obs && <span className="block text-xs text-muted-foreground">Sin valor diario</span>}
                  </TableCell>
                  <DailyValue value={obs?.temperature} quality={variableQuality('temperature')} expectedSlots={dailyQuality?.expectedSlots} />
                  <DailyValue value={obs?.humidity} quality={variableQuality('humidity')} expectedSlots={dailyQuality?.expectedSlots} />
                  <DailyValue value={obs?.windSpeed == null ? null : roundWind(obs.windSpeed)} quality={variableQuality('windSpeed')}
                    expectedSlots={dailyQuality?.expectedSlots} className={windCellClass(obs?.windSpeed ?? null)} />
                  <DailyValue value={obs?.windSpeedMax == null ? null : roundWind(obs.windSpeedMax)} quality={variableQuality('windSpeedMax')}
                    expectedSlots={dailyQuality?.expectedSlots} lowerBound className={windCellClass(obs?.windSpeedMax ?? null)} />
                  <TableCell className="text-right tabular-nums">{obs?.windGustTime ?? '—'}</TableCell>
                  <DailyValue value={obs?.precipitation} quality={variableQuality('precipitation')}
                    expectedSlots={dailyQuality?.expectedSlots} lowerBound />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {safePage + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
              <span className="sr-only">Página anterior</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
              <span className="sr-only">Página siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
