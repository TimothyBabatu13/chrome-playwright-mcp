export const THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000, label: 'Largest Contentful Paint', unit: 'ms' },
  fcpMs: { good: 1800, poor: 3000, label: 'First Contentful Paint', unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, label: 'Cumulative Layout Shift', unit: '' },
  totalBlockingMs: { good: 200, poor: 600, label: 'Total Blocking Time', unit: 'ms' },
  ttfbMs: { good: 800, poor: 1800, label: 'Time to First Byte', unit: 'ms' }
};

export function rate(metric, value) {
  const threshold = THRESHOLDS[metric];
  if (!threshold) return 'good';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export function formatValue(metric, value) {
  const threshold = THRESHOLDS[metric];
  if (!threshold) return String(value);
  if (threshold.unit === 'ms') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
  }
  return value.toFixed(3);
}

const ICONS = { good: '✅', 'needs-improvement': '⚠️ ', poor: '❌' };

export function icon(rating) {
  return ICONS[rating] ?? '•';
}

export function rateAll(vitals) {
  return Object.keys(THRESHOLDS)
    .filter(metric => vitals[metric] !== undefined)
    .map(metric => {
      const value = vitals[metric];
      const rating = rate(metric, value);
      return {
        metric,
        label: THRESHOLDS[metric].label,
        value,
        display: formatValue(metric, value),
        target: formatValue(metric, THRESHOLDS[metric].good),
        rating,
        icon: icon(rating)
      };
    });
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
