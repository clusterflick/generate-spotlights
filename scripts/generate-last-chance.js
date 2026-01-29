const fs = require("fs");
const path = require("path");

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

// Configuration constants
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const MIN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const MIN_IMDB_RATING = 5;
const MAX_PERFORMANCES = 4;
const MAX_VENUES = 2;

// Collage layout constants (centered positioning, so these are center points)
const POSTER_AREA = { minX: 5, maxX: 95, minY: 5, maxY: 88 };
const RADIAL_EXPANSION = 1.1; // Push posters outward by 10%
const JITTER_FACTOR = 0.5; // Jitter within 50% of cell size
const MAX_ROTATION_DEG = 8;
const BASE_POSTER_COUNT = 28; // Base count for poster sizing
const BASE_POSTER_WIDTH = 18; // Base width percentage at 36 posters

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
 * Find movies that will have no more performances after the end of the week
 * @param {Object} options - Filter options
 * @param {boolean} options.strictFilters - Apply strict filters for collage (rating, actors, performance/venue limits)
 */
function findLastChanceMovies(
  data,
  imdbRatings,
  uncategorisedGenreId,
  options = {},
) {
  const { strictFilters = true } = options;
  const endOfWeek = getEndOfWeek();
  const endOfWeekTimestamp = endOfWeek.getTime();
  const now = Date.now();

  const lastChanceMovies = [];

  for (const movieId in data.movies) {
    const movie = data.movies[movieId];

    // Skip movies with no performances
    if (!movie.performances || movie.performances.length === 0) {
      continue;
    }

    // Skip shorts - require feature-length films
    if (!movie.duration || movie.duration < MIN_DURATION_MS) {
      continue;
    }

    // Skip uncategorised movies (likely events, not proper films)
    if (uncategorisedGenreId && movie.genres?.includes(uncategorisedGenreId)) {
      continue;
    }

    // Get the latest performance time
    const latestPerformanceTime = Math.max(
      ...movie.performances.map((p) => p.time),
    );

    // Check if all performances are within this week (after now but before end of week)
    const hasUpcomingPerformances = movie.performances.some(
      (p) => p.time > now,
    );
    const allPerformancesEndThisWeek =
      latestPerformanceTime <= endOfWeekTimestamp;

    if (!hasUpcomingPerformances || !allPerformancesEndThisWeek) {
      continue;
    }

    const upcomingPerformances = movie.performances.filter((p) => p.time > now);
    const performanceCount = upcomingPerformances.length;
    const venueIds = new Set(
      Object.values(movie.showings).map((s) => s.venueId),
    );
    const venueCount = venueIds.size;

    const imdbData = imdbRatings[movie.id];
    const rating = imdbData?.rating;

    // Apply strict filters only for collage
    if (strictFilters) {
      // Skip movies without a poster
      if (!movie.posterPath) {
        continue;
      }

      // Skip movies with no actors listed (likely events or documentaries)
      if (!movie.actors || movie.actors.length === 0) {
        continue;
      }

      // Skip movies without a good IMDB rating
      if (!rating || rating < MIN_IMDB_RATING) {
        continue;
      }

      // Skip movies with too many showings (widely available)
      if (performanceCount > MAX_PERFORMANCES) {
        continue;
      }

      // Skip movies in too many venues (likely blockbusters)
      if (venueCount > MAX_VENUES) {
        continue;
      }
    }

    // Find the venue for the last performance
    const lastPerformance = movie.performances.find(
      (p) => p.time === latestPerformanceTime,
    );
    const lastShowing = movie.showings[lastPerformance?.showingId];
    const lastVenueId = lastShowing?.venueId;

    lastChanceMovies.push({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterPath ? TMDB_IMAGE_BASE + movie.posterPath : null,
      latestPerformance: new Date(latestPerformanceTime).toISOString(),
      lastVenueId,
      performanceCount,
      venueCount,
      rating,
    });
  }

  // Sort alphabetically by title
  lastChanceMovies.sort((a, b) => a.title.localeCompare(b.title));

  return lastChanceMovies;
}

/**
 * Generate HTML page with movie posters in a collage layout
 */
function generateHtml(movies) {
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    "last-chance.html",
  );
  const template = fs.readFileSync(templatePath, "utf8");

  const count = movies.length;
  const { minX, maxX, minY, maxY } = POSTER_AREA;

  // Scale poster size based on count (fewer posters = larger posters)
  // Max 30% width = 300px in 1000px container (300x450 at 2:3 aspect ratio)
  const scaleFactor = Math.sqrt(BASE_POSTER_COUNT / count);
  const MAX_POSTER_WIDTH = 30;
  const posterWidth = Math.min(
    BASE_POSTER_WIDTH * scaleFactor,
    MAX_POSTER_WIDTH,
  ).toFixed(1);

  // Increase radial expansion for fewer posters to fill edges
  const dynamicExpansion = RADIAL_EXPANSION + (scaleFactor - 1) * 0.01;

  // Create a grid that covers the full area
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellWidth = (maxX - minX) / cols;
  const cellHeight = (maxY - minY) / rows;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Shuffle movies for random z-order
  const shuffled = [...movies].sort(() => Math.random() - 0.5);

  const posterItems = shuffled
    .map((movie, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      // Position with jitter
      const jitterX = (Math.random() - 0.5) * cellWidth * JITTER_FACTOR;
      const jitterY = (Math.random() - 0.5) * cellHeight * JITTER_FACTOR;
      let posX = minX + cellWidth / 2 + col * cellWidth + jitterX;
      let posY = minY + cellHeight / 2 + row * cellHeight + jitterY;

      // Push outward from center (more aggressive for fewer posters)
      const dx = posX - centerX;
      const dy = posY - centerY;
      posX = centerX + dx * dynamicExpansion;
      posY = centerY + dy * dynamicExpansion;

      const rotation = (
        Math.random() * MAX_ROTATION_DEG * 2 -
        MAX_ROTATION_DEG
      ).toFixed(1);
      // Center poster on position, then apply rotation
      const style = `left: ${posX.toFixed(1)}%; top: ${posY.toFixed(1)}%; width: ${posterWidth}%; transform: translate(-50%, -50%) rotate(${rotation}deg); z-index: ${index};`;

      return `
    <div class="poster-item" style="${style}">
      <img src="${movie.posterUrl}" alt="${escapeHtml(movie.title)}" loading="eager">
    </div>`;
    })
    .join("");

  console.log(
    `Generated collage with ${count} posters in ${cols}x${rows} grid (poster width: ${posterWidth}%)`,
  );

  return template.replace("{{POSTER_ITEMS}}", posterItems);
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
 */
function formatSocialDate(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const dayNum = date.getDate();
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Only include month if different from current month
  if (
    date.getMonth() !== now.getMonth() ||
    date.getFullYear() !== now.getFullYear()
  ) {
    const month = date.toLocaleDateString("en-GB", { month: "short" });
    return `${weekday} ${dayNum}${getOrdinalSuffix(dayNum)} ${month} at ${time}`;
  }
  return `${weekday} ${dayNum}${getOrdinalSuffix(dayNum)} at ${time}`;
}

/**
 * Generate social media text file
 * @param {string} platform - 'twitter' or 'instagram'
 */
function generateSocialText(movies, venues, platform = "twitter") {
  const emojis = [
    "\u{1F3AC}",
    "\u{1F3A5}",
    "\u{1F4FD}",
    "\u2728",
    "\u2B50",
    "\u{1F37F}",
  ];
  const randomEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];

  // Group movies by venue
  const moviesByVenue = {};
  movies.forEach((movie) => {
    const venueId = movie.lastVenueId || "unknown";
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

  let text = `\u{1F3AC} LAST CHANCE THIS WEEK! \u{1F3AC}\n\n`;
  text += `These ${movies.length} films are leaving London cinemas soon - catch them before they're gone! \u{1F39F}\u{1F37F}\n\n`;
  text += `\u{1F310} Every film, every cinema, one place. Find showtimes at Clusterflick.com\n\n`;
  text += `---\n\n`;

  sortedVenueIds.forEach((venueId) => {
    const venue = venues[venueId];
    const venueName = venue?.name || "Unknown venue";
    const handle = venue?.socials?.[platform];
    const handleText = handle ? ` (@${handle})` : "";
    const venueMovies = moviesByVenue[venueId];

    text += `\u{1F4CD} ${venueName}${handleText}\n`;

    // Sort movies by showtime within venue
    venueMovies.sort(
      (a, b) => new Date(a.latestPerformance) - new Date(b.latestPerformance),
    );

    venueMovies.forEach((movie) => {
      const emoji = randomEmoji();
      text += `   ${emoji} ${movie.title} - ${formatSocialDate(movie.latestPerformance)}\n`;
    });

    text += `\n`;
  });

  text += `---\n\n`;
  text += `#LastChance #LondonCinema #IndieFilm #Clusterflick\n\n`;
  text += `\u{1F4A1} Pro tip: The best seat is the one you're actually sitting in. Go see something!`;

  return text;
}

// Main execution
const rootDir = path.join(__dirname, "..");
const dataPath = path.join(rootDir, "combined-data", "combined-data.json");
const imdbPath = path.join(rootDir, "matched-data", "imdb.json");

console.log(`Reading data from: ${dataPath}`);
const rawData = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(rawData);

console.log(`Reading IMDB ratings from: ${imdbPath}`);
const imdbRatings = JSON.parse(fs.readFileSync(imdbPath, "utf8"));

console.log(`Total movies in data: ${Object.keys(data.movies).length}`);
console.log(`Current time: ${new Date().toISOString()}`);
console.log(`End of week: ${getEndOfWeek().toISOString()}`);

const uncategorisedGenreId = findGenreIdByName(data.genres, "Uncategorised");

// Get filtered movies for the collage (strict filters)
const collageMovies = findLastChanceMovies(
  data,
  imdbRatings,
  uncategorisedGenreId,
  { strictFilters: true },
);
console.log(`\nFound ${collageMovies.length} movies for collage (filtered)`);

if (collageMovies.length > 0) {
  console.log("\nCollage movies:");
  collageMovies.forEach((m) => {
    console.log(
      `  - ${m.title} (${m.rating} IMDB, ${m.performanceCount} showings, ${m.venueCount} venues, last: ${formatDate(m.latestPerformance)})`,
    );
  });
}

// Limit collage to first N movies (set to null for all)
const MAX_COLLAGE_MOVIES = 100;
const limitedMovies = MAX_COLLAGE_MOVIES
  ? collageMovies.slice(0, MAX_COLLAGE_MOVIES)
  : collageMovies;
const html = generateHtml(limitedMovies);
const siteDir = path.join(rootDir, "site");
fs.mkdirSync(siteDir, { recursive: true });
const htmlPath = path.join(siteDir, "last-chance.html");
fs.writeFileSync(htmlPath, html);
console.log(`\nHTML generated: ${htmlPath}`);

// Get all last chance movies for social text (no strict filters)
const allLastChanceMovies = findLastChanceMovies(
  data,
  imdbRatings,
  uncategorisedGenreId,
  { strictFilters: false },
);
console.log(`Found ${allLastChanceMovies.length} movies for social text (all)`);

// Generate social media text files
const outputDir = path.join(rootDir, "output");
fs.mkdirSync(outputDir, { recursive: true });

const timestamp = getTimestamp();

// Generate Twitter version
const twitterText = generateSocialText(
  allLastChanceMovies,
  data.venues,
  "twitter",
);
const twitterPath = path.join(
  outputDir,
  `last-chance-twitter_${timestamp}.txt`,
);
fs.writeFileSync(twitterPath, twitterText, "utf8");
console.log(`Twitter text generated: ${twitterPath}`);

// Generate Instagram version
const instagramText = generateSocialText(
  allLastChanceMovies,
  data.venues,
  "instagram",
);
const instagramPath = path.join(
  outputDir,
  `last-chance-instagram_${timestamp}.txt`,
);
fs.writeFileSync(instagramPath, instagramText, "utf8");
console.log(`Instagram text generated: ${instagramPath}`);

// Generate generic version (no handles)
const genericText = generateSocialText(allLastChanceMovies, data.venues, null);
const genericPath = path.join(
  outputDir,
  `last-chance-generic_${timestamp}.txt`,
);
fs.writeFileSync(genericPath, genericText, "utf8");
console.log(`Generic text generated: ${genericPath}`);
