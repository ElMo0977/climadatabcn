import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DateRange } from '@/types/weather';
import { computeSubdailyCoverage } from '@/lib/subdailyCoverage';
import { DateRangePicker } from './DateRangePicker';

const MANUAL_FROM = new Date(2026, 1, 17, 13, 15, 20, 10);
const MANUAL_TO = new Date(2026, 1, 19, 9, 45, 10, 50);

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect,
  }: {
    selected?: Date;
    onSelect?: (date: Date) => void;
  }) => {
    const isToCalendar = selected?.getHours() === 23;
    const label = isToCalendar ? 'pick-to' : 'pick-from';
    const selectedDate = isToCalendar ? MANUAL_TO : MANUAL_FROM;
    return (
      <button type="button" onClick={() => onSelect?.(selectedDate)}>
        {label}
      </button>
    );
  },
}));

describe('DateRangePicker', () => {
  it('normalizes manual date picks to full days for 30min coverage', async () => {
    let latestRange: DateRange | null = null;

    function Harness() {
      const [dateRange, setDateRange] = useState<DateRange>({
        from: new Date(2026, 1, 10, 0, 0, 0, 0),
        to: new Date(2026, 1, 12, 23, 59, 59, 999),
      });

      return (
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={(next) => {
            latestRange = next;
            setDateRange(next);
          }}
          granularity="30min"
          onGranularityChange={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'pick-from' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick-to' }));

    await waitFor(() => {
      expect(latestRange).not.toBeNull();
    });

    const range = latestRange as DateRange;
    expect(range.from.getHours()).toBe(0);
    expect(range.from.getMinutes()).toBe(0);
    expect(range.from.getSeconds()).toBe(0);
    expect(range.from.getMilliseconds()).toBe(0);

    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMinutes()).toBe(59);
    expect(range.to.getSeconds()).toBe(59);
    expect(range.to.getMilliseconds()).toBe(999);

    const coverage = computeSubdailyCoverage(range, []);
    expect(coverage.expectedCount).toBe(48 * 3);
  });
});
