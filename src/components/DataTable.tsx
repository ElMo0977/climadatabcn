import { useState } from 'react';
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
import { formatTimestamp } from '@/lib/weatherUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableProps {
  observations: Observation[];
  granularity: Granularity;
  isLoading: boolean;
}

const PAGE_SIZE = 10;

export function DataTable({ observations, granularity, isLoading }: DataTableProps) {
  const [page, setPage] = useState(0);
  
  const totalPages = Math.ceil(observations.length / PAGE_SIZE);
  const startIndex = page * PAGE_SIZE;
  const paginatedData = observations.slice(startIndex, startIndex + PAGE_SIZE);
  const isHourly = granularity === 'hourly';

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

  if (observations.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No hay datos disponibles
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h4 className="font-display font-semibold text-sm">Datos detallados</h4>
        <span className="text-xs text-muted-foreground">
          {observations.length} registros
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Fecha/Hora</TableHead>
              <TableHead className="font-semibold text-right">Temp (°C)</TableHead>
              <TableHead className="font-semibold text-right">Humedad (%)</TableHead>
              <TableHead className="font-semibold text-right">Viento (m/s)</TableHead>
              {!isHourly && (
                <>
                  <TableHead className="font-semibold text-right">V. Mín (m/s)</TableHead>
                  <TableHead className="font-semibold text-right">V. Máx (m/s)</TableHead>
                </>
              )}
              <TableHead className="font-semibold text-right">Precip. (mm)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((obs, index) => (
              <TableRow key={`${obs.timestamp}-${index}`}>
                <TableCell className="font-medium">
                  {formatTimestamp(obs.timestamp, isHourly)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {obs.temperature !== null ? obs.temperature : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {obs.humidity !== null ? obs.humidity : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {obs.windSpeed !== null ? obs.windSpeed : '—'}
                </TableCell>
                {!isHourly && (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {obs.windSpeedMin !== null ? obs.windSpeedMin : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {obs.windSpeedMax !== null ? obs.windSpeedMax : '—'}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">
                  {obs.precipitation !== null ? obs.precipitation : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
