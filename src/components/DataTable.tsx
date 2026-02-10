import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Observation, Granularity } from '@/types/weather';
import { formatTimestamp, formatDayLabel } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
}

const PAGE_SIZE = 20;
const WIND_LIMIT_ACOUSTIC = 5;

export function DataTable({ observations, granularity, isLoading }: DataTableProps) {
  const [page, setPage] = useState(0);

  const isDetail = granularity === '30min';
  const totalPages = Math.ceil(observations.length / PAGE_SIZE) || 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const paginatedData = observations.slice(startIndex, startIndex + PAGE_SIZE);

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

  if (observations.length === 0) {
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
          {isDetail ? 'Datos detallados (30 min)' : 'Resumen diario'}
        </h4>
        <span className="text-xs text-muted-foreground">
          {observations.length} {isDetail ? 'registros' : 'días'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isDetail ? (
                <>
                  <TableHead className="font-semibold">Fecha/Hora</TableHead>
                  <TableHead className="font-semibold text-right">T (°C)</TableHead>
                  <TableHead className="font-semibold text-right">HR (%)</TableHead>
                  <TableHead className="font-semibold text-right">VV10 (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">DV10 (°)</TableHead>
                  <TableHead className="font-semibold text-right">VVx10 (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">PPT (mm)</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold text-right">TM (°C)</TableHead>
                  <TableHead className="font-semibold text-right">HRM (%)</TableHead>
                  <TableHead className="font-semibold text-right">VVM10 (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">VVX10 (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Hora racha</TableHead>
                  <TableHead className="font-semibold text-right">PPT (mm)</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((obs, index) => (
              <TableRow key={`${obs.timestamp}-${index}`}>
                {isDetail ? (
                  <>
                    <TableCell className="font-medium">{formatTimestamp(obs.timestamp, true)}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.temperature ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.humidity ?? '—'}</TableCell>
                    <TableCell className={windCellClass(obs.windSpeed)}>{roundWind(obs.windSpeed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.windDirection ?? '—'}</TableCell>
                    <TableCell className={windCellClass(obs.windSpeedMax)}>{roundWind(obs.windSpeedMax)}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.precipitation ?? '—'}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{formatDayLabel(obs.timestamp)}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.temperature ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.humidity ?? '—'}</TableCell>
                    <TableCell className={windCellClass(obs.windSpeed)}>{roundWind(obs.windSpeed)}</TableCell>
                    <TableCell className={windCellClass(obs.windSpeedMax)}>{roundWind(obs.windSpeedMax)}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.windGustTime ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{obs.precipitation ?? '—'}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
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
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
