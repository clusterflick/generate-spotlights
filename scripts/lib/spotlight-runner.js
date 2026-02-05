const fs = require("fs");
const path = require("path");
const { getTimestamp, findGenreIdByName, formatDate } = require("./utils");
const { generateCollageHtml } = require("./collage");
const { loadData } = require("./data-loader");
const {
  generateSocialText,
  generateInstagramCompactText,
  chunkForTwitterThread,
} = require("./social-text");

/**
 * Run a spotlight generation
 * @param {Object} config - Spotlight configuration
 * @param {string} config.name - Spotlight name (e.g., 'last-chance', 'new-films')
 * @param {string} config.templateName - HTML template filename
 * @param {Function} config.findMovies - Function(data, imdbRatings, uncategorisedGenreId, options) => movies[]
 * @param {Function} config.logMovie - Function(movie) => string for console output
 * @param {Object} config.socialText - Social text configuration
 * @param {string} config.socialText.header - Header text
 * @param {string} config.socialText.intro - Intro text (use {{count}} for count)
 * @param {string} config.socialText.hashtags - Hashtags
 * @param {string} config.socialText.venueIdField - Field name for venue ID
 * @param {Function} [config.socialText.formatMovieLine] - Optional movie line formatter
 * @param {Function} [config.logExtra] - Optional extra logging function
 * @param {number} [config.maxCollageMovies] - Max movies in collage (default 100)
 */
function runSpotlight(config) {
  const {
    name,
    templateName,
    findMovies,
    logMovie,
    socialText: socialTextConfig,
    logExtra,
    maxCollageMovies = 100,
  } = config;

  const rootDir = path.join(__dirname, "..", "..");
  const { data, imdbRatings } = loadData(rootDir);

  console.log(`Current time: ${new Date().toISOString()}`);
  if (logExtra) {
    logExtra();
  }

  const uncategorisedGenreId = findGenreIdByName(data.genres, "Uncategorised");

  // Get filtered movies for the collage (strict filters)
  const collageMovies = findMovies(data, imdbRatings, uncategorisedGenreId, {
    strictFilters: true,
  });
  console.log(`\nFound ${collageMovies.length} movies for collage (filtered)`);

  if (collageMovies.length > 0) {
    console.log("\nCollage movies:");
    collageMovies.forEach((m) => {
      console.log(`  - ${logMovie(m)}`);
    });
  }

  // Limit collage to first N movies
  const limitedMovies = maxCollageMovies
    ? collageMovies.slice(0, maxCollageMovies)
    : collageMovies;
  const html = generateCollageHtml(limitedMovies, templateName);
  const siteDir = path.join(rootDir, "site");
  fs.mkdirSync(siteDir, { recursive: true });
  const htmlPath = path.join(siteDir, `${name}.html`);
  fs.writeFileSync(htmlPath, html);
  console.log(`\nHTML generated: ${htmlPath}`);

  // Get all movies for social text (no strict filters)
  const allMovies = findMovies(data, imdbRatings, uncategorisedGenreId, {
    strictFilters: false,
  });
  console.log(`Found ${allMovies.length} movies for social text (all)`);

  // Generate social media text files
  const outputDir = path.join(rootDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = getTimestamp();

  // Generate for each platform
  const platforms = ["twitter", "instagram", null];
  const platformNames = ["twitter", "instagram", "generic"];

  platforms.forEach((platform, i) => {
    let text;
    if (platform === "instagram" && socialTextConfig.useInstagramCompact) {
      // Use compact format for Instagram if opted in
      text = generateInstagramCompactText(allMovies, data.venues, socialTextConfig);
    } else if (platform === "twitter") {
      // Generate full text then chunk for Twitter thread
      const fullText = generateSocialText(allMovies, data.venues, {
        ...socialTextConfig,
        platform,
      });
      text = chunkForTwitterThread(fullText);
    } else {
      text = generateSocialText(allMovies, data.venues, {
        ...socialTextConfig,
        platform,
      });
    }
    const outputPath = path.join(
      outputDir,
      `${name}-${platformNames[i]}_${timestamp}.txt`,
    );
    fs.writeFileSync(outputPath, text, "utf8");
    console.log(
      `${platformNames[i].charAt(0).toUpperCase() + platformNames[i].slice(1)} text generated: ${outputPath} (${text.length} chars)`,
    );
  });
}

module.exports = {
  runSpotlight,
};
