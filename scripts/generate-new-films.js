const {
  getStartOfWeek,
  getEndOfWeek,
  getEarliestSeenTimestamp,
  formatDate,
} = require("./lib/utils");
const { runSpotlight } = require("./lib/spotlight-runner");

// Configuration constants
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const MIN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const MIN_IMDB_RATING = 5;

/**
 * Find movies that were first seen this week
 */
function findNewFilms(data, imdbRatings, uncategorisedGenreId, options = {}) {
  const { strictFilters = true } = options;
  const startOfWeek = getStartOfWeek();
  const startOfWeekTimestamp = startOfWeek.getTime();
  const now = Date.now();

  const newFilms = [];

  for (const movieId in data.movies) {
    const movie = data.movies[movieId];

    // Get the earliest "seen" timestamp from showings
    const earliestSeen = getEarliestSeenTimestamp(movie);

    // Skip movies without a "seen" timestamp
    if (!earliestSeen) {
      continue;
    }

    // Skip movies seen before this week
    if (earliestSeen < startOfWeekTimestamp) {
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

    // Calculate performance info for display
    const upcomingPerformances = (movie.performances || []).filter(
      (p) => p.time > now,
    );
    const performanceCount = upcomingPerformances.length;

    // Skip movies with no upcoming performances
    if (performanceCount === 0) {
      continue;
    }

    const imdbData = imdbRatings[movie.id];
    const rating = imdbData?.rating;
    const venueIds = movie.showings
      ? new Set(Object.values(movie.showings).map((s) => s.venueId))
      : new Set();
    const venueCount = venueIds.size;

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
    }

    // Find the first venue (for social media grouping)
    let firstVenueId = null;
    if (upcomingPerformances.length > 0 && movie.showings) {
      const firstPerformance = upcomingPerformances.sort(
        (a, b) => a.time - b.time,
      )[0];
      const firstShowing = movie.showings[firstPerformance?.showingId];
      firstVenueId = firstShowing?.venueId;
    }

    newFilms.push({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterPath ? TMDB_IMAGE_BASE + movie.posterPath : null,
      seenAt: new Date(earliestSeen).toISOString(),
      firstVenueId,
      performanceCount,
      venueCount,
      rating,
    });
  }

  // Sort alphabetically by title
  newFilms.sort((a, b) => a.title.localeCompare(b.title));

  return newFilms;
}

// Run the spotlight
runSpotlight({
  name: "new-films",
  templateName: "new-films.html",
  findMovies: findNewFilms,
  logMovie: (m) =>
    `${m.title} (${m.rating} IMDB, ${m.performanceCount} showings, ${m.venueCount} venues, seen: ${formatDate(m.seenAt)})`,
  logExtra: () => {
    console.log(`Start of week: ${getStartOfWeek().toISOString()}`);
    console.log(`End of week: ${getEndOfWeek().toISOString()}`);
  },
  socialText: {
    header: "NEW FILMS THIS WEEK!",
    intro:
      "These {{count}} films just landed this week in London cinemas - check them out!",
    hashtags: "#NewFilms #LondonCinema #IndieFilm #Clusterflick",
    venueIdField: "firstVenueId",
    formatMovieLine: (movie, { compact }) =>
      compact ? `${movie.title}\n` : `   \u{1F3AC} ${movie.title}\n`,
    footer: "\u{1F37F} Fresh popcorn, fresh films. What are you waiting for?",
    useInstagramCompact: true,
  },
});
