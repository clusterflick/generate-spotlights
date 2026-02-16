const fs = require("fs");
const path = require("path");
const { getTimestamp, escapeHtml } = require("./lib/utils");
const { loadData } = require("./lib/data-loader");

// Configuration constants
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

/**
 * Generate a program spotlight for a 2-movie listing
 * @param {string} programId - The generated program ID (e.g., "097696a9")
 */
function generateProgram(programId) {
  const rootDir = path.join(__dirname, "..");
  const { data, imdbRatings, letterboxdRatings, rottenTomatoesRatings } =
    loadData(rootDir);

  // Find the program by generated ID
  const program = data.movies[programId];

  if (!program) {
    console.error(`Program with ID ${programId} not found in data`);
    console.error(
      `Make sure you're using a generated ID (e.g., "097696a9"), not a TMDB ID`,
    );
    process.exit(1);
  }

  // Validate that this program has exactly 2 included movies
  if (!program.includedMovies || program.includedMovies.length !== 2) {
    console.error(
      `Program "${program.title}" does not have exactly 2 included movies`,
    );
    if (!program.includedMovies || program.includedMovies.length === 0) {
      console.error(
        `This program has no included movies. Use generate-single-movie.js instead.`,
      );
    } else {
      console.error(
        `This program has ${program.includedMovies.length} included movies.`,
      );
      console.error(
        `Only 2-movie programs are supported. For 3+ movies, use the collage format (generate-new-films.js or generate-last-chance.js).`,
      );
    }
    process.exit(1);
  }

  console.log(`\nGenerating program spotlight for: ${program.title}`);
  console.log(`  Program ID: ${programId}`);

  // Extract both movies
  const movie1 = program.includedMovies[0];
  const movie2 = program.includedMovies[1];

  console.log(`  Movie 1: ${movie1.title}`);
  console.log(`  Movie 2: ${movie2.title}`);

  // Validate both movies have posters
  if (!movie1.posterPath || !movie2.posterPath) {
    console.error("One or both movies are missing posters");
    if (!movie1.posterPath) console.error(`  ${movie1.title} has no poster`);
    if (!movie2.posterPath) console.error(`  ${movie2.title} has no poster`);
    process.exit(1);
  }

  const poster1Url = TMDB_IMAGE_BASE + movie1.posterPath;
  const poster2Url = TMDB_IMAGE_BASE + movie2.posterPath;

  // Get venues where the program is showing
  const venueIds = new Set();
  const now = Date.now();
  let lastPerformanceTime = 0;
  let totalPerformanceCount = 0;

  if (program.showings) {
    for (const showingId in program.showings) {
      const showing = program.showings[showingId];
      // Check if showing has upcoming performances
      const upcomingPerformances = (program.performances || []).filter(
        (p) => p.showingId === showingId && p.time > now,
      );
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
  const displayItems = []; // { text: string, venueCount: number }

  if (venueData.length <= MAX_DISPLAY_ITEMS) {
    // List all venues individually when 7 or fewer
    venueData.forEach((venue) => {
      displayItems.push({ text: venue.name, venueCount: 1 });
    });
  } else {
    // Group venues by their group name when more than 7
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
          displayItems.push({ text: venueNames[0], venueCount: 1 });
        } else {
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
    const truncatedItems = displayItems.slice(MAX_DISPLAY_ITEMS - 1);
    moreVenueCount = truncatedItems.reduce(
      (sum, item) => sum + item.venueCount,
      0,
    );
  }

  // Format venue names as comma-separated list with "&" before last item
  const wrapVenue = (name) =>
    `<span class="venue-name">${escapeHtml(name)}</span>`;

  let venuesText = "";
  if (moreVenueCount > 0) {
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

  // Extract program year
  const programYear = program.releaseDate
    ? new Date(program.releaseDate).getFullYear()
    : program.year || "";

  // Get director names for both movies
  const getDirectorName = (movie) => {
    const directorId = movie.director || movie.directors?.[0] || "";
    if (directorId) {
      const person = data.people?.[directorId];
      return (
        person?.name ||
        (typeof directorId === "string" && !/^\d+$/.test(directorId)
          ? directorId
          : "")
      );
    }
    return "";
  };

  const director1Name = getDirectorName(movie1);
  const director2Name = getDirectorName(movie2);

  // Get synopses
  const synopsis1 = movie1.overview || movie1.synopsis || "";
  const synopsis2 = movie2.overview || movie2.synopsis || "";
  const programSynopsis = program.overview || program.synopsis || "";

  // Get years for both movies
  const movie1Year = movie1.releaseDate
    ? new Date(movie1.releaseDate).getFullYear()
    : movie1.year || "";
  const movie2Year = movie2.releaseDate
    ? new Date(movie2.releaseDate).getFullYear()
    : movie2.year || "";

  // Get ratings for both movies
  const getRatingsForMovie = (movie) => {
    const imdbData = imdbRatings[movie.id];
    const imdbRating = imdbData?.rating || "";

    const letterboxdData = letterboxdRatings[movie.id];
    const letterboxdRating = letterboxdData?.rating
      ? letterboxdData.rating.toFixed(1)
      : "";

    const rtData = rottenTomatoesRatings[movie.id];
    const rtCriticsScore = rtData?.critics?.all?.score || "";
    const rtAudienceScore = rtData?.audience?.all?.score || "";
    const rtCriticsIsFresh = rtCriticsScore !== "" && rtCriticsScore >= 60;
    const rtAudienceIsFresh = rtAudienceScore !== "" && rtAudienceScore >= 60;

    return {
      imdbRating,
      letterboxdRating,
      rtCriticsScore,
      rtAudienceScore,
      rtCriticsIsFresh,
      rtAudienceIsFresh,
    };
  };

  const ratings1 = getRatingsForMovie(movie1);
  const ratings2 = getRatingsForMovie(movie2);

  // Load the template
  const templatePath = path.join(rootDir, "templates", "program.html");
  let template = fs.readFileSync(templatePath, "utf8");

  // Replace placeholders
  template = template.replace(
    /\{\{PROGRAM_TITLE\}\}/g,
    escapeHtml(program.title),
  );
  template = template.replace(/\{\{PROGRAM_YEAR\}\}/g, programYear);
  template = template.replace(
    /\{\{PROGRAM_SYNOPSIS\}\}/g,
    escapeHtml(programSynopsis),
  );

  // Movie 1 placeholders
  template = template.replace(
    /\{\{MOVIE_1_TITLE\}\}/g,
    escapeHtml(movie1.title),
  );
  template = template.replace(/\{\{MOVIE_1_YEAR\}\}/g, movie1Year);
  template = template.replace(/\{\{MOVIE_1_POSTER_URL\}\}/g, poster1Url);
  template = template.replace(
    /\{\{MOVIE_1_DIRECTOR\}\}/g,
    escapeHtml(director1Name),
  );
  template = template.replace(
    /\{\{MOVIE_1_SYNOPSIS\}\}/g,
    escapeHtml(synopsis1),
  );
  template = template.replace(/\{\{MOVIE_1_IMDB\}\}/g, ratings1.imdbRating);
  template = template.replace(
    /\{\{MOVIE_1_LETTERBOXD\}\}/g,
    ratings1.letterboxdRating,
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_CRITICS\}\}/g,
    ratings1.rtCriticsScore !== "" ? `${ratings1.rtCriticsScore}%` : "",
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_AUDIENCE\}\}/g,
    ratings1.rtAudienceScore !== "" ? `${ratings1.rtAudienceScore}%` : "",
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_CRITICS_CLASS\}\}/g,
    ratings1.rtCriticsIsFresh ? "fresh" : "rotten",
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_AUDIENCE_CLASS\}\}/g,
    ratings1.rtAudienceIsFresh ? "fresh" : "rotten",
  );

  // Movie 2 placeholders
  template = template.replace(
    /\{\{MOVIE_2_TITLE\}\}/g,
    escapeHtml(movie2.title),
  );
  template = template.replace(/\{\{MOVIE_2_YEAR\}\}/g, movie2Year);
  template = template.replace(/\{\{MOVIE_2_POSTER_URL\}\}/g, poster2Url);
  template = template.replace(
    /\{\{MOVIE_2_DIRECTOR\}\}/g,
    escapeHtml(director2Name),
  );
  template = template.replace(
    /\{\{MOVIE_2_SYNOPSIS\}\}/g,
    escapeHtml(synopsis2),
  );
  template = template.replace(/\{\{MOVIE_2_IMDB\}\}/g, ratings2.imdbRating);
  template = template.replace(
    /\{\{MOVIE_2_LETTERBOXD\}\}/g,
    ratings2.letterboxdRating,
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_CRITICS\}\}/g,
    ratings2.rtCriticsScore !== "" ? `${ratings2.rtCriticsScore}%` : "",
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_AUDIENCE\}\}/g,
    ratings2.rtAudienceScore !== "" ? `${ratings2.rtAudienceScore}%` : "",
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_CRITICS_CLASS\}\}/g,
    ratings2.rtCriticsIsFresh ? "fresh" : "rotten",
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_AUDIENCE_CLASS\}\}/g,
    ratings2.rtAudienceIsFresh ? "fresh" : "rotten",
  );

  // Venues
  template = template.replace(/\{\{VENUES_TEXT\}\}/g, venuesText);

  // Hide rating badges when scores are unavailable for each movie
  template = template.replace(
    /\{\{MOVIE_1_LETTERBOXD_HIDDEN\}\}/g,
    ratings1.letterboxdRating ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_1_IMDB_HIDDEN\}\}/g,
    ratings1.imdbRating ? "" : "hidden",
  );
  const hasAnyRt1 =
    ratings1.rtCriticsScore !== "" || ratings1.rtAudienceScore !== "";
  template = template.replace(
    /\{\{MOVIE_1_RT_HIDDEN\}\}/g,
    hasAnyRt1 ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_CRITICS_HIDDEN\}\}/g,
    ratings1.rtCriticsScore !== "" ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_1_RT_AUDIENCE_HIDDEN\}\}/g,
    ratings1.rtAudienceScore !== "" ? "" : "hidden",
  );

  template = template.replace(
    /\{\{MOVIE_2_LETTERBOXD_HIDDEN\}\}/g,
    ratings2.letterboxdRating ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_2_IMDB_HIDDEN\}\}/g,
    ratings2.imdbRating ? "" : "hidden",
  );
  const hasAnyRt2 =
    ratings2.rtCriticsScore !== "" || ratings2.rtAudienceScore !== "";
  template = template.replace(
    /\{\{MOVIE_2_RT_HIDDEN\}\}/g,
    hasAnyRt2 ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_CRITICS_HIDDEN\}\}/g,
    ratings2.rtCriticsScore !== "" ? "" : "hidden",
  );
  template = template.replace(
    /\{\{MOVIE_2_RT_AUDIENCE_HIDDEN\}\}/g,
    ratings2.rtAudienceScore !== "" ? "" : "hidden",
  );

  // Write the HTML file
  const siteDir = path.join(rootDir, "site");
  fs.mkdirSync(siteDir, { recursive: true });
  const htmlPath = path.join(siteDir, "program.html");
  fs.writeFileSync(htmlPath, template);
  console.log(`\nHTML generated: ${htmlPath}`);

  // Generate social media text
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
  const infoPath = path.join(outputDir, `program_${timestamp}.txt`);

  // Build social media text
  let info = `🎬 DOUBLE FEATURE SPOTLIGHT! 🎬\n\n`;
  info += `${program.title}`;
  if (programYear) info += ` (${programYear})`;
  info += `\n\n`;

  // Movie 1
  info += `🎥 ${movie1.title}`;
  if (movie1Year) info += ` (${movie1Year})`;
  info += `\n`;
  if (director1Name) info += `Directed by ${director1Name}\n`;

  // Movie 1 ratings
  const rating1Parts = [];
  if (ratings1.letterboxdRating)
    rating1Parts.push(`💚 ${ratings1.letterboxdRating} /5 Letterboxd`);
  if (ratings1.imdbRating)
    rating1Parts.push(`⭐ ${ratings1.imdbRating} /10 IMDB`);
  if (ratings1.rtCriticsScore !== "" || ratings1.rtAudienceScore !== "") {
    let rtText = "";
    if (ratings1.rtCriticsScore !== "")
      rtText += `🍅 ${ratings1.rtCriticsScore}%`;
    if (ratings1.rtCriticsScore !== "" && ratings1.rtAudienceScore !== "")
      rtText += " ";
    if (ratings1.rtAudienceScore !== "")
      rtText += `🍿 ${ratings1.rtAudienceScore}%`;
    rtText += " Rotten Tomatoes";
    rating1Parts.push(rtText);
  }
  if (rating1Parts.length > 0) {
    info += `${rating1Parts.join("  •  ")}\n`;
  }
  info += `\n`;

  // Movie 2
  info += `🎥 ${movie2.title}`;
  if (movie2Year) info += ` (${movie2Year})`;
  info += `\n`;
  if (director2Name) info += `Directed by ${director2Name}\n`;

  // Movie 2 ratings
  const rating2Parts = [];
  if (ratings2.letterboxdRating)
    rating2Parts.push(`💚 ${ratings2.letterboxdRating} /5 Letterboxd`);
  if (ratings2.imdbRating)
    rating2Parts.push(`⭐ ${ratings2.imdbRating} /10 IMDB`);
  if (ratings2.rtCriticsScore !== "" || ratings2.rtAudienceScore !== "") {
    let rtText = "";
    if (ratings2.rtCriticsScore !== "")
      rtText += `🍅 ${ratings2.rtCriticsScore}%`;
    if (ratings2.rtCriticsScore !== "" && ratings2.rtAudienceScore !== "")
      rtText += " ";
    if (ratings2.rtAudienceScore !== "")
      rtText += `🍿 ${ratings2.rtAudienceScore}%`;
    rtText += " Rotten Tomatoes";
    rating2Parts.push(rtText);
  }
  if (rating2Parts.length > 0) {
    info += `${rating2Parts.join("  •  ")}\n`;
  }
  info += `\n`;

  // Venue info
  let showingText = "";
  if (totalPerformanceCount > 0 && showingDuration) {
    const perfWord =
      totalPerformanceCount === 1 ? "performance" : "performances";
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
  info += `#DoubleFeature #LondonCinema #IndieFilm #Clusterflick\n\n`;
  info += `✨ Discover something special at the cinema!`;

  fs.writeFileSync(infoPath, info, "utf8");
  console.log(`Social media text saved: ${infoPath}`);
}

// Get program ID from command line args
const programId = process.argv[2];

if (!programId) {
  console.error("Usage: node generate-program.js <PROGRAM_ID>");
  console.error("Example: node generate-program.js 097696a9");
  console.error("\nNote: Use the generated ID (hex string), not a TMDB ID.");
  console.error("To find 2-movie programs, run:");
  console.error(
    "  node -e \"const data = require('./combined-data.json'); Object.entries(data.movies).filter(([id,m]) => m.includedMovies?.length === 2).forEach(([id,m]) => console.log(id, m.title))\"",
  );
  process.exit(1);
}

generateProgram(programId);
