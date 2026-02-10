import { describe, expect, it } from 'vitest';
import { getWindKpiDisplay } from '@/lib/windKpi';

describe('getWindKpiDisplay', () => {
  it('shows media/racha when avg and max are both available', () => {
    const result = getWindKpiDisplay(2.5, 6.8);
    expect(result).toEqual({
      label: 'Viento media / racha',
      value: '2.5 / 6.8 m/s',
    });
  });

  it('shows max label when only max is available', () => {
    const result = getWindKpiDisplay(null, 7.2);
    expect(result).toEqual({
      label: 'Viento máx.',
      value: '7.2 m/s',
    });
  });
});
