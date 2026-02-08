import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Observation, Granularity } from '@/types/weather';
import { formatTimestamp, buildDailyWindReport, formatDayLabel } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
}

const PAGE_SIZE = 10;

const WIND_LIMIT_ACOUSTIC = 5;

export function DataTable({ observations, granularity, isLoading }: DataTableProps) {
  const [page, setPage] = useState(0);

  const isHourly = granularity === 'hourly';
  const dailyReport = useMemo(
    () => (granularity === 'daily' ? buildDailyWindReport(observations) : null),
    [observations, granularity],
  );

  const tableData = isHourly ? observations : dailyReport ?? [];
  const totalPages = Math.ceil(tableData.length / PAGE_SIZE) || 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const paginatedData = tableData.slice(startIndex, startIndex + PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (tableData.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No hay datos disponibles
        </p>
      </div>
    );
  }

  const roundWind = (v: number) => Math.round(v * 10) / 10;
  const windCellClass = (value: number | null) =>
    value !== null && value > WIND_LIMIT_ACOUSTIC
      ? 'text-right tabular-nums bg-orange-100 dark:bg-orange-950/50 font-bold'
      : 'text-right tabular-nums';

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h4 className="font-display font-semibold text-sm">Datos detallados</h4>
        <span className="text-xs text-muted-foreground">
          {tableData.length} {isHourly ? 'registros' : 'días'}
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isHourly ? (
                <>
                  <TableHead className="font-semibold">Fecha/Hora</TableHead>
                  <TableHead className="font-semibold text-right">Temp (°C)</TableHead>
                  <TableHead className="font-semibold text-right">Humedad (%)</TableHead>
                  <TableHead className="font-semibold text-right">Viento (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Precip. (mm)</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold text-right">Viento Mín (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Viento Media (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">Viento Máx (m/s)</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isHourly
              ? (paginatedData as Observation[]).map((obs, index) => (
                  <TableRow key={`${obs.timestamp}-${index}`}>
                    <TableCell className="font-medium">
                      {formatTimestamp(obs.timestamp, true)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {obs.temperature !== null ? obs.temperature : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {obs.humidity !== null ? obs.humidity : '—'}
                    </TableCell>
                    <TableCell className={windCellClass(obs.windSpeed)}>
                      {obs.windSpeed !== null ? obs.windSpeed : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {obs.precipitation !== null ? obs.precipitation : '—'}
                    </TableCell>
                  </TableRow>
                ))
              : (paginatedData as { time: string; windMin: number; windAvg: number; windMax: number }[]).map((row, index) => (
                  <TableRow key={`${row.time}-${index}`}>
                    <TableCell className="font-medium">
                      {formatDayLabel(row.time)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {roundWind(row.windMin)}
                    </TableCell>
                    <TableCell className={windCellClass(row.windAvg)}>
                      {roundWind(row.windAvg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {roundWind(row.windMax)}
                    </TableCell>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
