const { getEndOfWeek, formatDate, formatSocialDate } = require("./lib/utils");
const { runSpotlight } = require("./lib/spotlight-runner");

// Configuration constants
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const MIN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const MIN_IMDB_RATING = 5;
const MAX_PERFORMANCES = 4;
const MAX_VENUES = 2;

/**
 * Find movies that will have no more performances after the end of the week
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

// Run the spotlight
runSpotlight({
  name: "last-chance",
  templateName: "last-chance.html",
  findMovies: findLastChanceMovies,
  logMovie: (m) =>
    `${m.title} (${m.rating} IMDB, ${m.performanceCount} showings, ${m.venueCount} venues, last: ${formatDate(m.latestPerformance)})`,
  logExtra: () => {
    console.log(`End of week: ${getEndOfWeek().toISOString()}`);
  },
  socialText: {
    header: "LAST CHANCE THIS WEEK!",
    intro:
      "These {{count}} films are leaving London cinemas soon - catch them before they're gone!",
    hashtags: "#LastChance #LondonCinema #IndieFilm #Clusterflick",
    venueIdField: "lastVenueId",
    formatMovieLine: (movie, { compact }) =>
      compact
        ? `${movie.title} - ${formatSocialDate(movie.latestPerformance, true)}\n`
        : `   \u{1F3AC} ${movie.title} - ${formatSocialDate(movie.latestPerformance)}\n`,
    footer:
      "\u{1F4A1} Pro tip: The best seat is the one you're actually sitting in. Go see something!",
    useInstagramCompact: true,
  },
});
