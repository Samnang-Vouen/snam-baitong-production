/**
 * Locale-aware date/time formatting helpers.
 *
 * When Khmer is selected, use the km-KH locale so dates/times render
 * with Khmer month names and numerals.
 */

export function getLocale(lang) {
  return lang === 'km' ? 'km-KH' : 'en-US';
}

function toValidDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;

  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

export function formatDate(value, lang, options = undefined) {
  const date = toValidDate(value);
  if (!date) return '-';

  const locale = getLocale(lang);
  const fmtOptions =
    options ??
    /** @type {Intl.DateTimeFormatOptions} */ ({
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });

  return new Intl.DateTimeFormat(locale, fmtOptions).format(date);
}

export function formatTime(value, lang, options = undefined) {
  const date = toValidDate(value);
  if (!date) return '-';

  const locale = getLocale(lang);
  const fmtOptions =
    options ??
    /** @type {Intl.DateTimeFormatOptions} */ ({
      hour: '2-digit',
      minute: '2-digit',
    });

  return new Intl.DateTimeFormat(locale, fmtOptions).format(date);
}

export function formatDateTime(value, lang, options = undefined) {
  const date = toValidDate(value);
  if (!date) return '-';

  const locale = getLocale(lang);
  const fmtOptions =
    options ??
    /** @type {Intl.DateTimeFormatOptions} */ ({
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return new Intl.DateTimeFormat(locale, fmtOptions).format(date);
}
