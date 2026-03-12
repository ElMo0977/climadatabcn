export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDayKey(value: string): boolean {
  return DAY_KEY_RE.test(value);
}
