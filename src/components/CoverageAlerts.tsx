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
  const coverageDetails = [
    showQualityAlert ? `Parcial: ${partialDays} días · Incompleto: ${incompleteDays} días · Sin dato: ${missingDays} días` : null,
    showDaily && dailyCoverage?.missingCount ? `Faltan datos para ${dailyCoverage.missingCount} días: ${missingDaysText}` : null,
    showSubdaily && subdailyCoverage?.missingCount ? `Faltan ${subdailyCoverage.missingCount} registros de Datos 30 min` : null,
    showSubdaily && showLargestGap && subdailyCoverage?.largestGap
      ? `Faltan datos entre ${formatGapInterval(subdailyCoverage.largestGap.start, subdailyCoverage.largestGap.end)} (${subdailyCoverage.largestGap.missingCount} franjas)` : null,
    missingReadings ? 'Hay variables sin lectura en la vista de 30 minutos' : null,
  ].filter(Boolean).join('. ');
  const healthyText = hasEvidence ? granularity === '30min'
    ? 'Todo correcto en las lecturas visibles: validación XEMA confirmada; cobertura completa en los días seleccionados.'
    : 'Todo correcto: cobertura completa y validación XEMA confirmada'
    : 'No hay datos suficientes para confirmar la calidad';

  return (
    <div className="glass-card rounded-xl p-3" role="status">
      <p className="text-sm font-medium">
        {error ? <span role="img" aria-label={`Error al cargar datos: ${error.message}`}
          title={`Error al cargar datos: ${error.message}`} className="text-red-700 dark:text-red-300">×</span>
          : coverageIssue || validationIssue ? <>
            {coverageIssue && <span role="img" aria-label={`Cobertura: ${coverageDetails || 'Datos parciales, incompletos o ausentes'}`}
              title={`Cobertura: ${coverageDetails || 'Datos parciales, incompletos o ausentes'}`}
              className="text-orange-700 dark:text-orange-300">▲</span>}
            {validationIssue && <span role="img" aria-label={granularity === '30min'
              ? 'Validación XEMA de las lecturas visibles no confirmada' : 'Validación XEMA no confirmada'}
              title={granularity === '30min'
                ? 'Validación XEMA de las lecturas visibles no confirmada' : 'Validación XEMA no confirmada'}
              className="ml-1 text-amber-700 dark:text-amber-300">◇</span>}
          </> : healthyText}
      </p>
      <QualityLegend />
    </div>
  );
}
