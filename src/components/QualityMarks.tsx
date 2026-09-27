import type { XemaValidationStatus } from '@/types/weather';
import type { DailyCoverageStatus, DailyValidationStatus } from '@/lib/dailyQuality';

const validationLabels: Record<DailyValidationStatus, string> = {
  valid: 'validada',
  pending: 'pendiente',
  'not-started': 'no iniciada',
  unknown: 'desconocida',
  unreported: 'no informada',
  mixed: 'mixta',
};

export function ValidationMark({ status, detail }: { status: XemaValidationStatus | DailyValidationStatus; detail?: string }) {
  if (status === 'valid') return null;
  const label = detail ?? `Validación XEMA ${validationLabels[status]}`;
  return <span className="ml-1 text-amber-700 dark:text-amber-300" role="img"
    aria-label={label} title={label}>◇</span>;
}

export function CoverageMark({ status, detail, ariaLabel }: { status: DailyCoverageStatus | 'missing-reading'; detail?: string; ariaLabel?: string }) {
  if (status === 'complete') return null;
  const label = status === 'missing-reading' || status === 'missing' ? 'Sin dato' : status === 'partial' ? 'Parcial' : 'Incompleto';
  const description = ariaLabel ?? `Cobertura ${label.toLowerCase()}${detail ? `: ${detail}` : ''}`;
  return <span className="ml-1 text-orange-700 dark:text-orange-300" role="img"
    aria-label={description} title={description}>▲</span>;
}

export function QualityLegend() {
  return <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2" aria-label="Leyenda de calidad de datos">
    <span className="font-medium">Leyenda: </span>
    <span className="mr-3">◇ Validación XEMA no confirmada (consulta el estado en el dato)</span>
    <span className="mr-3">▲ Dato parcial, incompleto o ausente</span>
    <span>× Error técnico de carga</span>
  </div>;
}
