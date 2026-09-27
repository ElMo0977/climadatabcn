import { format, parseISO } from 'date-fns';
import type { DailyCoverage } from '@/lib/dailyCoverage';
import type { SubdailyCoverage } from '@/lib/subdailyCoverage';
import type { DailyQuality } from '@/lib/dailyQuality';
import type { Granularity, Observation, ObservationVariable } from '@/types/weather';
import { isFiniteNumber } from '@/lib/weatherUtils';
import { QualityLegend } from './QualityMarks';

const OBSERVATION_VARIABLES: ObservationVariable[] = [
  'temperature', 'humidity', 'windSpeed', 'windDirection', 'windSpeedMax', 'precipitation',
];

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
  granularity?: Granularity;
  observations?: Observation[];
  error?: Error | null;
  isLoading?: boolean;
}

export function CoverageAlerts({
  dailyCoverage,
  subdailyCoverage,
  showDaily,
  showSubdaily,
  showLargestGap,
  missingDaysText,
  dailyQualityByDay,
  granularity = 'daily',
  observations = [],
  error,
  isLoading = false,
}: CoverageAlertsProps) {
  const qualityDays = Object.values(dailyQualityByDay ?? {});
  const countDays = (status: 'partial' | 'incomplete' | 'missing') => qualityDays.filter((day) =>
    Object.values(day.variables).some((variable) => variable.status === status)).length;
  const partialDays = countDays('partial');
  const incompleteDays = countDays('incomplete');
  const missingDays = countDays('missing');
  const showQualityAlert = partialDays + incompleteDays + missingDays > 0;

  if (isLoading) return null;

  const detailVariables = observations.flatMap((observation) => OBSERVATION_VARIABLES.map((variable) => ({
    value: observation[variable],
    validation: observation.variableMetadata?.[variable]?.validationStatus ?? 'unreported',
  })));
  const missingReadings = granularity === '30min' && detailVariables.some(({ value }) => !isFiniteNumber(value));
  const unconfirmedReadings = granularity === '30min' && detailVariables.some(({ value, validation }) =>
    isFiniteNumber(value) && validation !== 'valid');
  const unconfirmedDays = qualityDays.some((day) => Object.values(day.variables).some((variable) =>
    variable.validationStatus !== 'valid' && Object.values(variable.validationCounts).some((count) => count > 0)));
  const coverageIssue = granularity === 'daily'
    ? showQualityAlert || showDaily || !!dailyCoverage?.missingCount
    : missingReadings || showSubdaily || !!subdailyCoverage?.missingCount;
  const validationIssue = granularity === 'daily' ? unconfirmedDays : unconfirmedReadings;
  const hasCoverageProof = granularity === 'daily'
    ? dailyCoverage !== null && dailyCoverage.expectedCount > 0
      && dailyCoverage.missingCount === 0 && qualityDays.length >= dailyCoverage.expectedCount
    : subdailyCoverage !== null && subdailyCoverage.expectedCount > 0
      && subdailyCoverage.missingCount === 0
      && subdailyCoverage.availableCount === subdailyCoverage.expectedCount && observations.length > 0;
  const hasEvidence = hasCoverageProof && (granularity === 'daily'
    ? qualityDays.length > 0 && qualityDays.every((day) => Object.values(day.variables).every((variable) =>
      variable.validationStatus === 'valid' && variable.validationCounts.valid > 0))
    : detailVariables.length > 0 && detailVariables.every(({ value, validation }) =>
      isFiniteNumber(value) && validation === 'valid'));
  const headline = error ? '⊗ Error al cargar datos'
    : coverageIssue ? '▲! Hay datos parciales, incompletos o ausentes'
      : validationIssue ? granularity === '30min'
        ? `◇? ${hasCoverageProof ? 'Cobertura completa en los días seleccionados; ' : ''}validación XEMA de las lecturas visibles no confirmada`
        : `◇? ${hasCoverageProof ? 'Cobertura completa; ' : ''}validación XEMA no confirmada`
        : hasEvidence ? granularity === '30min'
          ? 'Todo correcto en las lecturas visibles: validación XEMA confirmada; cobertura completa en los días seleccionados.'
          : 'Todo correcto: cobertura completa y validación XEMA confirmada'
          : 'No hay datos suficientes para confirmar la calidad';

  return (
    <div className="glass-card rounded-xl p-3" role="status">
      <p className="text-sm font-medium">{headline}</p>
      {error ? <p className="text-xs text-muted-foreground">{error.message}</p> : <>
      {coverageIssue && validationIssue && <p className="text-xs text-muted-foreground">◇? También hay lecturas cuya validación XEMA no está confirmada.</p>}
      {showQualityAlert && (
        <div>
          <p className="text-xs text-muted-foreground">
            Parcial: {partialDays} día{partialDays === 1 ? '' : 's'} · Incompleto: {incompleteDays} día{incompleteDays === 1 ? '' : 's'} · Sin dato: {missingDays} día{missingDays === 1 ? '' : 's'}.
            Un día puede aparecer en más de una categoría porque cada variable se evalúa por separado.
          </p>
          <p className="text-xs text-muted-foreground">Consulta el detalle de cobertura y validación en la tabla diaria. Los valores incompletos no se incluyen en los KPI.</p>
        </div>
      )}
      {showDaily && dailyCoverage && (
        <div>
          <p className="text-sm font-medium">
            Datos disponibles para {dailyCoverage.availableCount} de {dailyCoverage.expectedCount} días.
          </p>
          <p className="text-xs text-muted-foreground">
            Faltan datos para {dailyCoverage.missingCount} día{dailyCoverage.missingCount === 1 ? '' : 's'}: {missingDaysText}
          </p>
        </div>
      )}

      {showSubdaily && subdailyCoverage && (
        <div>
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
      </>}
      <QualityLegend />
    </div>
  );
}
