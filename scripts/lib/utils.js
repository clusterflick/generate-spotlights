/**
 * Shared utility functions for spotlight generation
 */

/**
 * Generate a timestamp string for filenames (YYYY-MM-DD_HHMM)
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}`;
}

/**
 * Find a genre ID by name
 */
function findGenreIdByName(genres, name) {
  for (const id in genres) {
    if (genres[id].name === name) {
      return id;
    }
  }
  return null;
}

/**
 * Get the start of the current week (Monday 00:00:00)
 */
function getStartOfWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return startOfWeek;
}

/**
 * Get the end of the current week (Sunday 23:59:59)
 */
function getEndOfWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilEndOfWeek = 7 - dayOfWeek; // Days until next Sunday

  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilEndOfWeek);
  endOfWeek.setHours(23, 59, 59, 999);

  return endOfWeek;
}

/**
 * Get the earliest "seen" timestamp from a movie's showings
 * The "seen" field is on each showing, not on the movie itself
 */
function getEarliestSeenTimestamp(movie) {
  if (!movie.showings) return null;

  const seenTimestamps = Object.values(movie.showings)
    .map((s) => s.seen)
    .filter((s) => s != null);

  if (seenTimestamps.length === 0) return null;

  return Math.min(...seenTimestamps);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format ISO date to readable format
 */
function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Format date for social media (friendlier format)
 * @param {string} isoDate - ISO date string
 * @param {boolean} compact - Use compact format for character-limited platforms
 */
function formatSocialDate(isoDate, compact = false) {
  const date = new Date(isoDate);
  const now = new Date();
  const dayNum = date.getDate();

  if (compact) {
    // Compact format: "Wed 4 @ 8pm" or "Wed 4 Feb @ 8pm"
    const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
    const hour = date.getHours();
    const minute = date.getMinutes();
    const hour12 = hour % 12 || 12;
    const ampm = hour < 12 ? "am" : "pm";
    const timeStr =
      minute === 0
        ? `${hour12}${ampm}`
        : `${hour12}:${String(minute).padStart(2, "0")}${ampm}`;

    if (
      date.getMonth() !== now.getMonth() ||
      date.getFullYear() !== now.getFullYear()
    ) {
      const month = date.toLocaleDateString("en-GB", { month: "short" });
      return `${weekday} ${dayNum} ${month} @ ${timeStr}`;
    }
    return `${weekday} ${dayNum} @ ${timeStr}`;
  }

  // Full format: "Wednesday 4th at 20:00"
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (
    date.getMonth() !== now.getMonth() ||
    date.getFullYear() !== now.getFullYear()
  ) {
    const month = date.toLocaleDateString("en-GB", { month: "short" });
    return `${weekday} ${dayNum}${getOrdinalSuffix(dayNum)} ${month} at ${time}`;
  }
  return `${weekday} ${dayNum}${getOrdinalSuffix(dayNum)} at ${time}`;
}

module.exports = {
  getTimestamp,
  findGenreIdByName,
  getStartOfWeek,
  getEndOfWeek,
  getEarliestSeenTimestamp,
  escapeHtml,
  formatDate,
  getOrdinalSuffix,
  formatSocialDate,
};
