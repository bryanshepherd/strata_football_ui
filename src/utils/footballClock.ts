export type CanonicalFootballClock = `${number}${number}:${number}${number}`;

const displayMinutes = (minutes: string): string => minutes.replace(/^0(?=\d)/, '');

export function normalizeFootballClock(value: unknown): CanonicalFootballClock | null {
  const rawValue = String(value ?? '').trim();
  const colonMatch = rawValue.match(/^(\d{1,2}):([0-5]\d)$/);
  if (colonMatch) {
    return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}` as CanonicalFootballClock;
  }

  const digits = rawValue.match(/^\d{3,4}$/)?.[0];
  if (!digits) return null;
  const minuteDigits = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2);
  const secondDigits = digits.slice(-2);
  if (Number(secondDigits) > 59) return null;
  return `${minuteDigits.padStart(2, '0')}:${secondDigits}` as CanonicalFootballClock;
}

export function formatFootballClockEntry(value: unknown): string {
  const rawValue = String(value ?? '');
  if (rawValue.includes(':')) {
    const [minutes = '', ...secondParts] = rawValue.split(':');
    const minuteDigits = minutes.replace(/\D/g, '').slice(0, 2);
    const secondDigits = secondParts.join('').replace(/\D/g, '');
    const combinedDigits = `${minuteDigits}${secondDigits}`.slice(0, 4);
    if (secondDigits.length > 2 && combinedDigits.length >= 3) {
      return formatFootballClockEntry(combinedDigits);
    }
    return `${displayMinutes(minuteDigits)}:${secondDigits.slice(0, 2)}`;
  }

  const digits = rawValue.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${displayMinutes(digits.slice(0, 2))}:${digits.slice(2)}`;
}

export function formatFootballClockDisplay(value: unknown, fallback = ''): string {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? `${Number(match[1])}:${match[2]}` : (String(value ?? '').trim() || fallback);
}
