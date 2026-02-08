const fs = require("fs");
const path = require("path");
const { getTimestamp, escapeHtml } = require("./lib/utils");
const { loadData } = require("./lib/data-loader");

// Configuration constants
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

/**
 * Generate a single movie spotlight
 * @param {string} tmdbId - The TMDB movie ID
 */
function generateSingleMovie(tmdbId) {
  const rootDir = path.join(__dirname, "..");
  const { data, imdbRatings, letterboxdRatings, rottenTomatoesRatings } =
    loadData(rootDir);

  // Find the movie by TMDB ID - check top-level movies first, then includedMovies
  let movie = data.movies[tmdbId];
  let parentMovie = null;

  if (!movie) {
    // Search through includedMovies arrays to find this TMDB ID
    for (const [parentId, parent] of Object.entries(data.movies)) {
      if (parent.includedMovies) {
        const included = parent.includedMovies.find((m) => m.id === tmdbId);
        if (included) {
          movie = included;
          parentMovie = parent;
          console.log(
            `Found as included movie within: ${parent.title} (${parentId})`,
          );
          break;
        }
      }
    }
  }

  if (!movie) {
    console.error(`Movie with TMDB ID ${tmdbId} not found in data`);
    process.exit(1);
  }

  console.log(`\nGenerating spotlight for: ${movie.title}`);
  console.log(`  TMDB ID: ${tmdbId}`);
  console.log(`  Poster path: ${movie.posterPath || "none"}`);

  if (!movie.posterPath) {
    console.error("Movie does not have a poster");
    process.exit(1);
  }

  const posterUrl = TMDB_IMAGE_BASE + movie.posterPath;

  // Use the parent movie's showings/performances when this is an included movie
  const showingsSource = parentMovie || movie;

  // Get venues where the movie is showing and find the last performance
  const venueIds = new Set();
  const now = Date.now();
  let lastPerformanceTime = 0;
  let totalPerformanceCount = 0;

  if (showingsSource.showings) {
    for (const showingId in showingsSource.showings) {
      const showing = showingsSource.showings[showingId];
      // Check if showing has upcoming performances
      const upcomingPerformances = (
        showingsSource.performances || []
      ).filter((p) => p.showingId === showingId && p.time > now);
      if (upcomingPerformances.length > 0 && showing.venueId) {
        venueIds.add(showing.venueId);
        totalPerformanceCount += upcomingPerformances.length;
        // Track the latest performance time
        upcomingPerformances.forEach((p) => {
          if (p.time > lastPerformanceTime) {
            lastPerformanceTime = p.time;
          }
        });
      }
    }
  }

  // Calculate showing duration text
  let showingDuration = "";
  if (lastPerformanceTime > now) {
    const daysUntilLast = Math.ceil(
      (lastPerformanceTime - now) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilLast <= 3) {
      showingDuration = `the next ${daysUntilLast} day${daysUntilLast === 1 ? "" : "s"}`;
    } else if (daysUntilLast <= 7) {
      showingDuration = "the next week";
    } else if (daysUntilLast <= 14) {
      showingDuration = "the next 2 weeks";
    } else if (daysUntilLast <= 21) {
      showingDuration = "the next 3 weeks";
    } else if (daysUntilLast <= 35) {
      showingDuration = "the next month";
    } else if (daysUntilLast <= 60) {
      showingDuration = "the next 2 months";
    } else {
      const months = Math.round(daysUntilLast / 30);
      showingDuration = `the next ${months} months`;
    }
  }

  // Get venue data with group info
  const venueData = Array.from(venueIds)
    .map((id) => data.venues[id])
    .filter(Boolean);

  const MAX_DISPLAY_ITEMS = 7;

  // Build display items - only group when there are more than 7 venues
  // Track both the display text and the venue count for each item
  const displayItems = []; // { text: string, venueCount: number }

  if (venueData.length <= MAX_DISPLAY_ITEMS) {
    // List all venues individually when 7 or fewer
    venueData.forEach((venue) => {
      displayItems.push({ text: venue.name, venueCount: 1 });
    });
  } else {
    // Group venues by their group name when more than 7
    // Track both count and venue names for each group
    const groupedVenues = {}; // { groupName: [venueName, ...] }
    const ungroupedVenues = [];

    venueData.forEach((venue) => {
      const groupName = venue.groupName;
      if (groupName) {
        if (!groupedVenues[groupName]) {
          groupedVenues[groupName] = [];
        }
        groupedVenues[groupName].push(venue.name);
      } else {
        ungroupedVenues.push(venue.name);
      }
    });

    // Add grouped venues (e.g., "7 ODEONs")
    Object.entries(groupedVenues)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([groupName, venueNames]) => {
        if (venueNames.length === 1) {
          // Use full venue name if only one venue in the group
          displayItems.push({ text: venueNames[0], venueCount: 1 });
        } else {
          // Pluralize: add 's' if doesn't end in 's'
          const plural = groupName.endsWith("s") ? groupName : `${groupName}s`;
          displayItems.push({
            text: `${venueNames.length} ${plural}`,
            venueCount: venueNames.length,
          });
        }
      });

    // Add ungrouped venues
    ungroupedVenues.sort((a, b) => a.localeCompare(b));
    ungroupedVenues.forEach((name) => {
      displayItems.push({ text: name, venueCount: 1 });
    });
  }

  // Sort all display items alphabetically by text
  displayItems.sort((a, b) => a.text.localeCompare(b.text));

  console.log(
    `  Venues (${venueData.length} total): ${displayItems.length > 0 ? displayItems.map((d) => d.text).join(", ") : "none"}`,
  );

  // If more than 7 items, truncate and add "& X more"
  let finalItems = displayItems;
  let moreVenueCount = 0;

  if (displayItems.length > MAX_DISPLAY_ITEMS) {
    finalItems = displayItems.slice(0, MAX_DISPLAY_ITEMS - 1);
    // Calculate actual venue count for truncated items
    const truncatedItems = displayItems.slice(MAX_DISPLAY_ITEMS - 1);
    moreVenueCount = truncatedItems.reduce(
      (sum, item) => sum + item.venueCount,
      0,
    );
  }

  // Format venue names as comma-separated list with "&" before last item
  // Wrap each venue name in a span for styling
  const wrapVenue = (name) =>
    `<span class="venue-name">${escapeHtml(name)}</span>`;

  let venuesText = "";
  if (moreVenueCount > 0) {
    // Show first items + "& X more"
    const itemsText = finalItems.map((item) => wrapVenue(item.text)).join(", ");
    venuesText = `${itemsText}, & ${wrapVenue(`${moreVenueCount} more`)}`;
  } else if (finalItems.length === 1) {
    venuesText = wrapVenue(finalItems[0].text);
  } else if (finalItems.length === 2) {
    venuesText = `${wrapVenue(finalItems[0].text)} & ${wrapVenue(finalItems[1].text)}`;
  } else if (finalItems.length > 2) {
    const allButLast = finalItems
      .slice(0, -1)
      .map((item) => wrapVenue(item.text))
      .join(", ");
    venuesText = `${allButLast}, & ${wrapVenue(finalItems[finalItems.length - 1].text)}`;
  }

  // For info file, use original venue names
  const venueNames = venueData
    .map((v) => v.name)
    .sort((a, b) => a.localeCompare(b));

  // Extract year for template replacement
  const year = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : movie.year || "";

  // Look up director name - director field may be an ID
  const directorId = movie.director || movie.directors?.[0] || "";
  let directorName = "";
  if (directorId) {
    // Try to look up from people data
    const person = data.people?.[directorId];
    directorName =
      person?.name ||
      (typeof directorId === "string" && !/^\d+$/.test(directorId)
        ? directorId
        : "");
  }

  // Get synopsis
  const synopsis = movie.overview || movie.synopsis || "";

  // Get ratings from all sources
  const imdbData = imdbRatings[tmdbId];
  const imdbRating = imdbData?.rating || "";

  const letterboxdData = letterboxdRatings[tmdbId];
  const letterboxdRating = letterboxdData?.rating
    ? letterboxdData.rating.toFixed(1)
    : "";

  const rtData = rottenTomatoesRatings[tmdbId];
  const rtCriticsScore = rtData?.critics?.all?.score || "";
  const rtAudienceScore = rtData?.audience?.all?.score || "";
  // Determine if fresh (≥60%) or rotten (<60%)
  const rtCriticsIsFresh = rtCriticsScore !== "" && rtCriticsScore >= 60;
  const rtAudienceIsFresh = rtAudienceScore !== "" && rtAudienceScore >= 60;

  // Load the template
  const templatePath = path.join(rootDir, "templates", "single-movie.html");
  let template = fs.readFileSync(templatePath, "utf8");

  // Replace placeholders
  template = template.replace(/\{\{MOVIE_TITLE\}\}/g, escapeHtml(movie.title));
  template = template.replace(/\{\{MOVIE_YEAR\}\}/g, year);
  template = template.replace(/\{\{POSTER_URL\}\}/g, posterUrl);
  template = template.replace(/\{\{VENUES_TEXT\}\}/g, venuesText);
  template = template.replace(
    /\{\{DIRECTOR_NAME\}\}/g,
    escapeHtml(directorName),
  );
  template = template.replace(/\{\{SYNOPSIS\}\}/g, escapeHtml(synopsis));
  template = template.replace(/\{\{IMDB_RATING\}\}/g, imdbRating);
  template = template.replace(/\{\{LETTERBOXD_RATING\}\}/g, letterboxdRating);
  template = template.replace(
    /\{\{RT_CRITICS_SCORE\}\}/g,
    rtCriticsScore !== "" ? `${rtCriticsScore}%` : "",
  );
  template = template.replace(
    /\{\{RT_CRITICS_CLASS\}\}/g,
    rtCriticsIsFresh ? "fresh" : "rotten",
  );
  template = template.replace(
    /\{\{RT_AUDIENCE_SCORE\}\}/g,
    rtAudienceScore !== "" ? `${rtAudienceScore}%` : "",
  );
  template = template.replace(
    /\{\{RT_AUDIENCE_CLASS\}\}/g,
    rtAudienceIsFresh ? "fresh" : "rotten",
  );

  // Hide rating badges when scores are unavailable
  template = template.replace(
    /\{\{LETTERBOXD_HIDDEN\}\}/g,
    letterboxdRating ? "" : "hidden",
  );
  template = template.replace(
    /\{\{IMDB_HIDDEN\}\}/g,
    imdbRating ? "" : "hidden",
  );
  const hasAnyRt = rtCriticsScore !== "" || rtAudienceScore !== "";
  template = template.replace(/\{\{RT_HIDDEN\}\}/g, hasAnyRt ? "" : "hidden");
  template = template.replace(
    /\{\{RT_CRITICS_HIDDEN\}\}/g,
    rtCriticsScore !== "" ? "" : "hidden",
  );
  template = template.replace(
    /\{\{RT_AUDIENCE_HIDDEN\}\}/g,
    rtAudienceScore !== "" ? "" : "hidden",
  );

  // Write the HTML file
  const siteDir = path.join(rootDir, "site");
  fs.mkdirSync(siteDir, { recursive: true });
  const htmlPath = path.join(siteDir, "single-movie.html");
  fs.writeFileSync(htmlPath, template);
  console.log(`\nHTML generated: ${htmlPath}`);

  // Also write movie info to output directory
  const outputDir = path.join(rootDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  // Format venues as plain text (without HTML)
  let venuesPlainText = "";
  if (moreVenueCount > 0) {
    const itemsText = finalItems.map((item) => item.text).join(", ");
    venuesPlainText = `${itemsText}, & ${moreVenueCount} more`;
  } else if (finalItems.length === 1) {
    venuesPlainText = finalItems[0].text;
  } else if (finalItems.length === 2) {
    venuesPlainText = `${finalItems[0].text} & ${finalItems[1].text}`;
  } else if (finalItems.length > 2) {
    const allButLast = finalItems
      .slice(0, -1)
      .map((item) => item.text)
      .join(", ");
    venuesPlainText = `${allButLast}, & ${finalItems[finalItems.length - 1].text}`;
  }

  const timestamp = getTimestamp();
  const infoPath = path.join(outputDir, `single-movie_${timestamp}.txt`);

  // Build social-style text with header and footer
  let info = `🎬 MOVIE SPOTLIGHT! 🎬\n\n`;
  info += `${movie.title}`;
  if (year) info += ` (${year})`;
  info += `\n`;
  if (directorName) info += `Directed by ${directorName}\n`;
  info += `\n`;
  if (synopsis) info += `${synopsis}\n\n`;

  // Add ratings if available (order: Letterboxd, IMDB, RT)
  const ratingParts = [];
  if (letterboxdRating)
    ratingParts.push(`💚 ${letterboxdRating} /5 Letterboxd`);
  if (imdbRating) ratingParts.push(`⭐ ${imdbRating} /10 IMDB`);
  if (rtCriticsScore !== "" || rtAudienceScore !== "") {
    let rtText = "";
    if (rtCriticsScore !== "") rtText += `🍅 ${rtCriticsScore}%`;
    if (rtCriticsScore !== "" && rtAudienceScore !== "") rtText += " ";
    if (rtAudienceScore !== "") rtText += `🍿 ${rtAudienceScore}%`;
    rtText += " Rotten Tomatoes";
    ratingParts.push(rtText);
  }
  if (ratingParts.length > 0) {
    info += `${ratingParts.join("  •  ")}\n\n`;
  }

  // Build the showing text with performance count and duration
  let showingText = "";
  if (totalPerformanceCount > 0 && showingDuration) {
    const perfWord =
      totalPerformanceCount === 1 ? "performance" : "performances";
    // For single performance, use "in 3 weeks" instead of "over the next 3 weeks"
    let durationText;
    if (totalPerformanceCount === 1) {
      durationText = `in ${showingDuration.replace("the next ", "")}`;
    } else {
      durationText = `over ${showingDuration}`;
    }
    showingText = `Showing ${totalPerformanceCount} ${perfWord} ${durationText}, at ${venuesPlainText}`;
  } else if (totalPerformanceCount > 0) {
    const perfWord =
      totalPerformanceCount === 1 ? "performance" : "performances";
    showingText = `Showing ${totalPerformanceCount} ${perfWord}, at ${venuesPlainText}`;
  } else {
    showingText = `Now showing at ${venuesPlainText}`;
  }
  info += `📍 ${showingText}\n\n`;
  info += `🌐 Every film, every cinema, one place. Find showtimes at Clusterflick.com\n\n`;
  info += `---\n\n`;
  info += `#NowShowing #LondonCinema #IndieFilm #Clusterflick\n\n`;
  info += `✨ Discover something special at the cinema!`;

  fs.writeFileSync(infoPath, info, "utf8");
  console.log(`Info saved: ${infoPath}`);
}

// Get TMDB ID from command line args
const tmdbId = process.argv[2];

if (!tmdbId) {
  console.error("Usage: node generate-single-movie.js <TMDB_ID>");
  console.error("Example: node generate-single-movie.js 550");
  process.exit(1);
}

generateSingleMovie(tmdbId);
