const { formatSocialDate } = require("./utils");

/**
 * Generate social media text file
 * @param {Array} movies - Array of movie objects
 * @param {Object} venues - Venues data
 * @param {Object} config - Configuration for the social text
 * @param {string} config.platform - 'twitter', 'instagram', or null
 * @param {string} config.header - Header text (e.g., "LAST CHANCE THIS WEEK!")
 * @param {string} config.intro - Intro text template (use {{count}} for movie count)
 * @param {string} config.hashtags - Hashtag string
 * @param {string} config.venueIdField - Field name for venue ID on movie object
 * @param {Function} [config.formatMovieLine] - Optional custom formatter for movie lines
 * @param {string} [config.footer] - Optional footer/easter egg text
 */
function generateSocialText(movies, venues, config) {
  const {
    platform = "twitter",
    header,
    intro,
    hashtags,
    venueIdField = "lastVenueId",
    formatMovieLine,
    footer,
  } = config;

  const emojis = [
    "\u{1F3AC}",
    "\u{1F3A5}",
    "\u{1F4FD}",
    "\u2728",
    "\u2B50",
    "\u{1F37F}",
  ];
  const randomEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];

  // Default movie line formatter
  const defaultFormatLine = (movie, emoji) => {
    const ratingText = movie.rating ? ` (${movie.rating} IMDB)` : "";
    return `   ${emoji} ${movie.title}${ratingText}\n`;
  };

  const formatLine = formatMovieLine || defaultFormatLine;

  // Group movies by venue
  const moviesByVenue = {};
  movies.forEach((movie) => {
    const venueId = movie[venueIdField] || "unknown";
    if (!moviesByVenue[venueId]) {
      moviesByVenue[venueId] = [];
    }
    moviesByVenue[venueId].push(movie);
  });

  // Sort venues by name
  const sortedVenueIds = Object.keys(moviesByVenue).sort((a, b) => {
    const nameA = venues[a]?.name || "Unknown venue";
    const nameB = venues[b]?.name || "Unknown venue";
    return nameA.localeCompare(nameB);
  });

  let text = `\u{1F3AC} ${header} \u{1F3AC}\n\n`;
  text += `${intro.replace("{{count}}", movies.length)} \u{1F39F}\u{1F37F}\n\n`;
  text += `\u{1F310} Every film, every cinema, one place. Find showtimes at Clusterflick.com\n\n`;
  text += `---\n\n`;

  sortedVenueIds.forEach((venueId) => {
    const venue = venues[venueId];
    const venueName = venue?.name || "Unknown venue";
    const handle = venue?.socials?.[platform];
    const handleText = handle ? ` (@${handle})` : "";
    const venueMovies = moviesByVenue[venueId];

    text += `\u{1F4CD} ${venueName}${handleText}\n`;

    // Sort movies alphabetically within venue
    venueMovies.sort((a, b) => a.title.localeCompare(b.title));

    venueMovies.forEach((movie) => {
      const emoji = randomEmoji();
      text += formatLine(movie, emoji);
    });

    text += `\n`;
  });

  text += `---\n\n`;
  text += `${hashtags}\n\n`;
  text += footer;

  return text;
}

module.exports = {
  generateSocialText,
};
