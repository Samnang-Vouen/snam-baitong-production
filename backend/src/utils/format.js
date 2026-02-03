function formatTimestamp(ts) {
  if (ts == null) return null;
  if (ts instanceof Date) return ts.toISOString();

  // Try numeric input
  let n;
  if (typeof ts === 'number') {
    n = ts;
  } else if (typeof ts === 'string') {
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      n = num;
    } else {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      return ts; // Unknown string, return as-is
    }
  } else {
    return String(ts);
  }

  // Detect units: seconds vs milliseconds vs microseconds
  // Rough thresholds: seconds ~ 1e9, ms ~ 1e12, microseconds ~ 1e15
  let ms;
  if (n >= 1e14) {
    ms = Math.round(n / 1000); // microseconds → ms
  } else if (n >= 1e11) {
    ms = Math.round(n); // milliseconds
  } else {
    ms = Math.round(n * 1000); // seconds
  }
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toISOString();
}

function toDate(ts) {
  if (ts == null) return null;
  if (ts instanceof Date) return ts;
  let n;
  if (typeof ts === 'number') {
    n = ts;
  } else if (typeof ts === 'string') {
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      n = num;
    } else {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } else {
    return null;
  }
  let ms;
  if (n >= 1e14) {
    ms = Math.round(n / 1000);
  } else if (n >= 1e11) {
    ms = Math.round(n);
  } else {
    ms = Math.round(n * 1000);
  }
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getPreferredTimeZone() {
  return (
    process.env.APP_TIMEZONE ||
    process.env.TIMEZONE ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

function formatTimestampLocal(ts, opts = {}) {
  const d = toDate(ts);
  if (!d) return null;
  const tz = getPreferredTimeZone();
  const { includeTZName = false, locale } = opts;
  const fmt = new Intl.DateTimeFormat(locale || undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
    timeZoneName: includeTZName ? 'shortOffset' : undefined,
  });
  return fmt.format(d);
}

module.exports = { formatTimestamp, formatTimestampLocal };
