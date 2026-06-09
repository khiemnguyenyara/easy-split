import {
  formatNumber,
  formatCurrency,
  formatAmountInput,
  parseAmount,
  formatDate,
  formatFullDate,
} from '../format';

describe('parseAmount', () => {
  it('parses a grouped Vietnamese amount string back to a number', () => {
    expect(parseAmount('1.000.000')).toBe(1000000);
  });

  it('strips any non-digit characters (currency suffix, spaces)', () => {
    expect(parseAmount('1.234đ')).toBe(1234);
    expect(parseAmount(' 50 000 ')).toBe(50000);
  });

  it('returns 0 for empty or non-numeric input', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('formatAmountInput', () => {
  it('groups raw digits with thousand separators as the user types', () => {
    expect(formatAmountInput('1000000')).toBe('1.000.000');
  });

  it('returns an empty string when there are no digits', () => {
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput('abc')).toBe('');
  });

  it('round-trips with parseAmount', () => {
    for (const value of ['0', '5000', '1234567', '999999999']) {
      expect(parseAmount(formatAmountInput(value))).toBe(Number(value));
    }
  });
});

describe('formatNumber / formatCurrency', () => {
  it('formats a plain grouped number without a suffix', () => {
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('appends the VND suffix', () => {
    expect(formatCurrency(1000000)).toBe('1.000.000đ');
  });

  it('drops the sign when abs is requested', () => {
    expect(formatCurrency(-5000, { abs: true })).toBe('5.000đ');
    expect(formatCurrency(-5000)).toBe('-5.000đ');
  });
});

describe('date formatters', () => {
  it('returns an empty string for nullish dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatFullDate(null)).toBe('');
  });

  it('formats a valid date as day/month', () => {
    // Shape check only: two-digit day and month with a locale-defined separator
    // (ICU may render '/' or '-' depending on the runtime), no exact separator assumed.
    expect(formatDate('2026-06-15T10:00:00Z')).toMatch(/^\d{2}\D\d{2}$/);
  });
});
