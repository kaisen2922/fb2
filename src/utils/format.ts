const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const currencyCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat('en-US');

const numberCompactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export const formatCurrency = (val: number): string => {
  return currencyFormatter.format(val);
};

export const formatCurrencyCompact = (val: number): string => {
  return currencyCompactFormatter.format(val);
};

export const formatNumber = (val: number): string => {
  return numberFormatter.format(val);
};

export const formatNumberCompact = (val: number): string => {
  return numberCompactFormatter.format(val);
};

export const formatPercent = (val: number): string => {
  return `${val.toFixed(1)}%`;
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return timeFormatter.format(date) + '.' + String(date.getMilliseconds()).padStart(3, '0');
};
