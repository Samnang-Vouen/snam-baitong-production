/**
 * Responsive Text Utilities
 * 
 * Helper functions to ensure text displays properly across all devices
 * and translations are handled responsively.
 */

/**
 * Truncates text to a specified length and adds ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text with ellipsis if needed
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Responsive text truncation based on screen size
 * @param {string} text - The text to truncate
 * @returns {string} Truncated text based on window width
 */
export function responsiveTruncate(text) {
  if (!text) return '';
  
  const width = window.innerWidth;
  
  if (width < 380) {
    return truncateText(text, 30);
  } else if (width < 576) {
    return truncateText(text, 40);
  } else if (width < 768) {
    return truncateText(text, 60);
  } else if (width < 992) {
    return truncateText(text, 80);
  }
  
  return text;
}

/**
 * Breaks long words to prevent overflow
 * @param {string} text - The text to process
 * @returns {string} Text with word break opportunities
 */
export function addWordBreaks(text) {
  if (!text) return '';
  
  // Add zero-width spaces after certain characters to allow breaking
  return text
    .replace(/([/\\-_.,;:])/g, '$1\u200B') // After punctuation
    .replace(/([a-z])([A-Z])/g, '$1\u200B$2'); // Between camelCase
}

/**
 * Format text for responsive display
 * Combines truncation and word breaking
 * @param {string} text - The text to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted text
 */
export function formatResponsiveText(text, options = {}) {
  const {
    truncate = false,
    maxLength = null,
    breakWords = true
  } = options;
  
  if (!text) return '';
  
  let formatted = text;
  
  if (truncate) {
    formatted = maxLength 
      ? truncateText(formatted, maxLength)
      : responsiveTruncate(formatted);
  }
  
  if (breakWords) {
    formatted = addWordBreaks(formatted);
  }
  
  return formatted;
}

/**
 * Get responsive font size class based on text length
 * @param {string} text - The text to analyze
 * @returns {string} CSS class name for font size
 */
export function getResponsiveFontClass(text) {
  if (!text) return 'fs-6';
  
  const length = text.length;
  
  if (length > 100) return 'fs-7 fs-sm-6';
  if (length > 50) return 'fs-6 fs-sm-5';
  if (length > 30) return 'fs-5 fs-sm-4';
  
  return 'fs-5';
}

/**
 * Check if text will overflow container
 * @param {string} text - The text to check
 * @param {number} containerWidth - Width of container in pixels
 * @param {number} fontSize - Font size in pixels
 * @returns {boolean} True if text will overflow
 */
export function willTextOverflow(text, containerWidth, fontSize = 16) {
  if (!text) return false;
  
  // Approximate character width (varies by font)
  const avgCharWidth = fontSize * 0.6;
  const textWidth = text.length * avgCharWidth;
  
  return textWidth > containerWidth;
}

/**
 * Apply responsive text wrapping
 * Returns inline styles for text wrapping
 * @returns {object} React inline style object
 */
export function getTextWrapStyles() {
  return {
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    msHyphens: 'auto',
  };
}

/**
 * Get container padding based on screen size
 * @returns {object} Responsive padding styles
 */
export function getResponsivePadding() {
  const width = window.innerWidth;
  
  if (width < 380) {
    return { padding: '0.5rem' };
  } else if (width < 576) {
    return { padding: '0.75rem' };
  } else if (width < 768) {
    return { padding: '1rem' };
  } else if (width < 992) {
    return { padding: '1.25rem' };
  }
  
  return { padding: '1.5rem' };
}

/**
 * Detect if device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
}

/**
 * Detect if device is in landscape mode
 * @returns {boolean} True if landscape orientation
 */
export function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

/**
 * Get device type
 * @returns {string} Device type: 'mobile', 'tablet', or 'desktop'
 */
export function getDeviceType() {
  const width = window.innerWidth;
  
  if (width < 576) return 'mobile';
  if (width < 992) return 'tablet';
  return 'desktop';
}

/**
 * Format phone number for responsive display
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhoneResponsive(phone) {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  const deviceType = getDeviceType();
  
  // On mobile, show compact format
  if (deviceType === 'mobile' && cleaned.length > 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

/**
 * Apply responsive class names based on screen size
 * @param {object} classMap - Object with device types as keys and class names as values
 * @returns {string} Space-separated class names
 */
export function applyResponsiveClasses(classMap) {
  const deviceType = getDeviceType();
  const classes = [];
  
  if (classMap.all) classes.push(classMap.all);
  if (classMap[deviceType]) classes.push(classMap[deviceType]);
  
  return classes.join(' ');
}

export default {
  truncateText,
  responsiveTruncate,
  addWordBreaks,
  formatResponsiveText,
  getResponsiveFontClass,
  willTextOverflow,
  getTextWrapStyles,
  getResponsivePadding,
  isMobileDevice,
  isLandscape,
  getDeviceType,
  formatPhoneResponsive,
  applyResponsiveClasses,
};
