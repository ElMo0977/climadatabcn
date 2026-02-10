function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface WindKpiDisplay {
  label: string;
  value: string;
}

export function getWindKpiDisplay(avgWindSpeed: unknown, maxWindSpeed: unknown): WindKpiDisplay {
  const hasAvg = isFiniteNumber(avgWindSpeed);
  const hasMax = isFiniteNumber(maxWindSpeed);

  if (hasAvg && hasMax) {
    return {
      label: 'Viento media / racha',
      value: `${avgWindSpeed} / ${maxWindSpeed} m/s`,
    };
  }

  if (hasAvg) {
    return {
      label: 'Viento media',
      value: `${avgWindSpeed} m/s`,
    };
  }

  if (hasMax) {
    return {
      label: 'Viento máx.',
      value: `${maxWindSpeed} m/s`,
    };
  }

  return {
    label: 'Viento',
    value: '—',
  };
}
