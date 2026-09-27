import { format, parseISO } from 'date-fns';
import type { DailyCoverage } from '@/lib/dailyCoverage';
import type { SubdailyCoverage } from '@/lib/subdailyCoverage';
import type { DailyQuality } from '@/lib/dailyQuality';

function formatGapSlot(slot: string): string {
  const isoLike = slot.replace(' ', 'T');
  try {
    return format(parseISO(isoLike), 'HH:mm');
  } catch {
    return slot;
  }
}

function formatGapInterval(startSlot: string, endSlot: string): string {
  const startDay = startSlot.slice(0, 10);
  const endDay = endSlot.slice(0, 10);

  if (startDay === endDay) {
    return `${formatGapSlot(startSlot)} y ${formatGapSlot(endSlot)}`;
  }

  return `${startSlot} y ${endSlot}`;
}

interface CoverageAlertsProps {
  dailyCoverage: DailyCoverage | null;
  subdailyCoverage: SubdailyCoverage | null;
  showDaily: boolean;
  showSubdaily: boolean;
  showLargestGap: boolean;
  missingDaysText: string;
  dailyQualityByDay?: Record<string, DailyQuality> | null;
}

export function CoverageAlerts({
  dailyCoverage,
  subdailyCoverage,
  showDaily,
  showSubdaily,
  showLargestGap,
  missingDaysText,
  dailyQualityByDay,
}: CoverageAlertsProps) {
  const qualityDays = Object.values(dailyQualityByDay ?? {});
  const countDays = (status: 'partial' | 'incomplete' | 'missing') => qualityDays.filter((day) =>
    Object.values(day.variables).some((variable) => variable.status === status)).length;
  const partialDays = countDays('partial');
  const incompleteDays = countDays('incomplete');
  const missingDays = countDays('missing');
  const showQualityAlert = partialDays + incompleteDays + missingDays > 0;

  return (
    <>
      {showQualityAlert && (
        <div className="glass-card rounded-xl p-3 border-amber-400/50 bg-amber-100/40" role="status">
          <p className="text-sm font-medium">Calidad diaria por variable: hay datos parciales, incompletos o ausentes.</p>
          <p className="text-xs text-muted-foreground">
            Parcial: {partialDays} día{partialDays === 1 ? '' : 's'} · Incompleto: {incompleteDays} día{incompleteDays === 1 ? '' : 's'} · Sin dato: {missingDays} día{missingDays === 1 ? '' : 's'}.
            Un día puede aparecer en más de una categoría porque cada variable se evalúa por separado.
          </p>
          <p className="text-xs text-muted-foreground">Consulta el detalle de cobertura y validación en la tabla diaria. Los valores incompletos no se incluyen en los KPI.</p>
        </div>
      )}
      {showDaily && dailyCoverage && (
        <div className="glass-card rounded-xl p-3 border-amber-400/50 bg-amber-100/40">
          <p className="text-sm font-medium">
            Datos disponibles para {dailyCoverage.availableCount} de {dailyCoverage.expectedCount} días.
          </p>
          <p className="text-xs text-muted-foreground">
            Faltan datos para {dailyCoverage.missingCount} día{dailyCoverage.missingCount === 1 ? '' : 's'}: {missingDaysText}
          </p>
        </div>
      )}

      {showSubdaily && subdailyCoverage && (
        <div className="glass-card rounded-xl p-3 border-amber-400/50 bg-amber-100/40">
          <p className="text-sm font-medium">
            Datos 30 min disponibles para {subdailyCoverage.availableCount} de {subdailyCoverage.expectedCount} franjas.
          </p>
          <p className="text-xs text-muted-foreground">
            {subdailyCoverage.availableCount === 0
              ? 'No hay Datos 30 min para el rango seleccionado en la estación.'
              : `Faltan ${subdailyCoverage.missingCount} registro${subdailyCoverage.missingCount === 1 ? '' : 's'} de Datos 30 min en el rango seleccionado.`}
          </p>
          {showLargestGap && subdailyCoverage.largestGap && (
            <>
              <p className="text-xs text-muted-foreground">
                Faltan datos entre {formatGapInterval(subdailyCoverage.largestGap.start, subdailyCoverage.largestGap.end)} ({subdailyCoverage.largestGap.missingCount} franjas).
              </p>
              <p className="text-xs text-muted-foreground">
                La fuente de dades obertes (Socrata) no publica algunas franjas. Meteocat puede mostrar datos aún en control de calidad.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
