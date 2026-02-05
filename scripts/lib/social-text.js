const { formatSocialDate } = require("./utils");

// Platform character limits
const PLATFORM_LIMITS = {
  instagram: 2000,
};

/**
 * Generate compact Instagram text with top picks and venue summary
 * @param {Array} movies - Array of movie objects (must have rating and venue info)
 * @param {Object} venues - Venues data
 * @param {Object} config - Configuration for the social text
 */
function generateInstagramCompactText(movies, venues, config) {
  const {
    header,
    intro,
    hashtags,
    venueIdField = "lastVenueId",
    footer,
    topPicksCount = 15,
    minFilmsPerVenue = 2,
  } = config;

  const charLimit = PLATFORM_LIMITS.instagram;

  // Group movies by venue
  const moviesByVenue = {};
  movies.forEach((movie) => {
    const venueId = movie[venueIdField] || "unknown";
    if (!moviesByVenue[venueId]) {
      moviesByVenue[venueId] = [];
    }
    moviesByVenue[venueId].push(movie);
  });

  // Get top picks by rating
  const topPicks = [...movies]
    .filter((m) => m.rating)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, topPicksCount);

  // Get venues with 2+ films, sorted by count
  const venueList = Object.entries(moviesByVenue)
    .map(([venueId, venueMovies]) => ({
      venueId,
      venue: venues[venueId],
      count: venueMovies.length,
    }))
    .sort((a, b) => b.count - a.count);

  const multiFilmVenues = venueList.filter((v) => v.count >= minFilmsPerVenue);
  const singleFilmCount = venueList.filter((v) => v.count < minFilmsPerVenue).length;

  // Build header section
  // Replace "These {{count}}" with just "{{count}}" for compact format
  const compactIntro = intro
    .replace("These {{count}}", "{{count}}")
    .replace("{{count}}", movies.length);
  let output = `\u{1F3AC} ${header} \u{1F3AC}\n\n`;
  output += `${compactIntro} \u{1F39F}\u{1F37F}\n\n`;
  output += `\u{1F310} Every film, every cinema, one place. Find showtimes at Clusterflick.com\n\n`;
  output += `---\n\n`;

  // Top picks section
  output += `\u{1F3AC} TOP PICKS\n`;
  topPicks.forEach((movie) => {
    const venue = venues[movie[venueIdField]];
    const venueName = venue?.name || "Unknown venue";
    output += `${movie.title} @ ${venueName}\n`;
  });

  // Venues section
  output += `\n\u{1F4CD} VENUES\n`;
  multiFilmVenues.forEach((v) => {
    const venueName = v.venue?.name || "Unknown venue";
    const handle = v.venue?.socials?.instagram;
    const handleText = handle ? ` @${handle}` : "";
    output += `${venueName}${handleText} - ${v.count} films\n`;
  });
  if (singleFilmCount > 0) {
    output += `+${singleFilmCount} more venues with 1 film each\n`;
  }

  // Footer section
  output += `\n---\n\n`;
  output += `${hashtags}\n\n`;
  output += footer;

  // If over limit, reduce top picks count
  if (output.length > charLimit) {
    const reduced = { ...config, topPicksCount: topPicksCount - 2 };
    return generateInstagramCompactText(movies, venues, reduced);
  }

  return output;
}

/**
 * Generate social media text file (full format for Twitter/generic)
 * @param {Array} movies - Array of movie objects
 * @param {Object} venues - Venues data
 * @param {Object} config - Configuration for the social text
 * @param {string} config.platform - 'twitter', 'instagram', or null
 * @param {string} config.header - Header text (e.g., "LAST CHANCE THIS WEEK!")
 * @param {string} config.intro - Intro text template (use {{count}} for movie count)
 * @param {string} config.hashtags - Hashtag string
 * @param {string} config.venueIdField - Field name for venue ID on movie object
 * @param {Function} [config.formatMovieLine] - Optional custom formatter (movie, options) => string
 * @param {string} [config.footer] - Optional footer/easter egg text
 * @param {number} [config.maxLength] - Optional maximum character length (overrides platform default)
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
    maxLength,
  } = config;

  // Determine character limit - explicit maxLength takes priority, then platform default
  const charLimit = maxLength ?? PLATFORM_LIMITS[platform] ?? null;
  // Use compact formatting (no indent/emoji) for Instagram and Twitter
  const compact = platform === "instagram" || platform === "twitter";

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
  const defaultFormatLine = (movie, { compact }) => {
    const ratingText = movie.rating ? ` (${movie.rating} IMDB)` : "";
    if (compact) {
      return `${movie.title}${ratingText}\n`;
    }
    const emoji = randomEmoji();
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

  // Build header section - always use nice format with emojis
  const headerSection =
    `\u{1F3AC} ${header} \u{1F3AC}\n\n` +
    `${intro.replace("{{count}}", movies.length)} \u{1F39F}\u{1F37F}\n\n` +
    `\u{1F310} Every film, every cinema, one place. Find showtimes at Clusterflick.com\n\n` +
    `---\n\n`;

  // Build footer section - always use nice format
  const footerSection = `---\n\n${hashtags}\n\n${footer}`;

  // Build venue sections as an array so we can truncate if needed
  const venueSections = [];
  sortedVenueIds.forEach((venueId) => {
    const venue = venues[venueId];
    const venueName = venue?.name || "Unknown venue";
    const handle = venue?.socials?.[platform];
    const handleText = handle ? ` @${handle}` : "";
    const venueMovies = moviesByVenue[venueId];

    let venueText = compact
      ? `\u{1F4CD} ${venueName}${handleText}\n`
      : `\u{1F4CD} ${venueName}${handleText ? ` (${handleText.trim()})` : ""}\n`;

    // Sort movies alphabetically within venue
    venueMovies.sort((a, b) => a.title.localeCompare(b.title));

    venueMovies.forEach((movie) => {
      venueText += formatLine(movie, { compact });
    });

    venueText += `\n`;
    venueSections.push(venueText);
  });

  // If no character limit, return full text
  if (!charLimit) {
    return headerSection + venueSections.join("") + footerSection;
  }

  // Build text within character limit
  const moreIndicator = `\n+more at clusterflick.com\n`;

  let venueContent = "";
  let includedAll = true;

  for (const section of venueSections) {
    if (
      headerSection.length + venueContent.length + section.length + footerSection.length <=
      charLimit
    ) {
      venueContent += section;
    } else {
      includedAll = false;
      break;
    }
  }

  if (includedAll) {
    return headerSection + venueContent + footerSection;
  }

  // Truncated version with "more" indicator
  return headerSection + venueContent + moreIndicator + footerSection;
}

/**
 * Split social text into Twitter thread chunks (max 280 chars each)
 * Keeps venue groups together and puts header+footer in first message
 * @param {string} text - Full text to split
 * @param {number} maxChunkSize - Max characters per chunk (default 280)
 * @returns {string} - Chunks separated by "\n\n---THREAD---\n\n"
 */
function chunkForTwitterThread(text, maxChunkSize = 280) {
  // Reserve space for "\n(XX/YY)" suffix - up to 10 chars
  const counterReserve = 10;
  const effectiveMax = maxChunkSize - counterReserve;

  // Split into header, venue sections, and footer
  const parts = text.split("---\n\n");
  // parts[0] = header, parts[1] = venues content, parts[2] = footer (hashtags + pro tip)

  const header = parts[0].trim();
  const venuesContent = parts[1] || "";
  const footer = parts.slice(2).join("---\n\n").trim();

  // First chunk: header only, footer will be last chunk
  const firstChunk = header;

  // Parse venue sections (each starts with 📍)
  const venueBlocks = [];
  let currentBlock = "";

  venuesContent.split("\n").forEach((line) => {
    if (line.startsWith("\u{1F4CD}") && currentBlock.trim()) {
      // New venue starting, save previous block
      venueBlocks.push(currentBlock.trim());
      currentBlock = line + "\n";
    } else {
      currentBlock += line + "\n";
    }
  });
  if (currentBlock.trim()) {
    venueBlocks.push(currentBlock.trim());
  }

  // Build chunks from venue blocks
  const chunks = [firstChunk];
  let currentChunk = "";

  for (const block of venueBlocks) {
    // If block fits in current chunk, add it
    if (currentChunk.length + block.length + 2 <= effectiveMax) {
      currentChunk += (currentChunk ? "\n\n" : "") + block;
    } else {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // If single block is too long, we need to split it
      if (block.length > effectiveMax) {
        const lines = block.split("\n");
        currentChunk = "";
        for (const line of lines) {
          if (currentChunk.length + line.length + 1 <= effectiveMax) {
            currentChunk += (currentChunk ? "\n" : "") + line;
          } else {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = line;
          }
        }
      } else {
        currentChunk = block;
      }
    }
  }

  // Don't forget the last venue chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Add footer as final chunk
  if (footer) {
    chunks.push(footer);
  }

  // Add thread counters on new line
  const total = chunks.length;
  const numberedChunks = chunks.map(
    (chunk, i) => `${chunk}\n(${i + 1}/${total})`,
  );

  return numberedChunks.join("\n\n---THREAD---\n\n");
}

module.exports = {
  generateSocialText,
  generateInstagramCompactText,
  chunkForTwitterThread,
};
