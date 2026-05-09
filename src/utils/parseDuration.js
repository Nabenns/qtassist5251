/**
 * Parse duration string to milliseconds
 * Supported formats: 1m, 30m, 1h, 12h, 1d, 7d, 1w
 * Kombinasi: 1d12h30m
 *
 * @param {string} durationStr - Duration string (e.g., "7d", "1h30m")
 * @returns {number|null} - Duration in milliseconds or null if invalid
 */
function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    return null;
  }

  const regex = /(\d+)([mhdw])/g;
  let totalMs = 0;
  let match;
  let hasMatch = false;

  while ((match = regex.exec(durationStr.toLowerCase())) !== null) {
    hasMatch = true;
    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': // minutes
        totalMs += value * 60 * 1000;
        break;
      case 'h': // hours
        totalMs += value * 60 * 60 * 1000;
        break;
      case 'd': // days
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case 'w': // weeks
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        return null;
    }
  }

  return hasMatch ? totalMs : null;
}

/**
 * Format milliseconds to human-readable duration
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration (e.g., "7 days", "1 hour 30 minutes")
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }

  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    parts.push(`${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`);
  }

  const remainingMinutes = minutes % 60;
  if (remainingMinutes > 0 && parts.length < 2) {
    parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);
  }

  return parts.join(' ') || '0 minutes';
}

module.exports = {
  parseDuration,
  formatDuration
};
