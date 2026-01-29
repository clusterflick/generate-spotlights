const fs = require("fs");
const path = require("path");
const { escapeHtml } = require("./utils");

// Collage layout constants (centered positioning, so these are center points)
const POSTER_AREA = { minX: 5, maxX: 95, minY: 5, maxY: 88 };
const RADIAL_EXPANSION = 1.1; // Push posters outward by 10%
const JITTER_FACTOR = 0.5; // Jitter within 50% of cell size
const MAX_ROTATION_DEG = 8;
const BASE_POSTER_COUNT = 28; // Base count for poster sizing
const BASE_POSTER_WIDTH = 18; // Base width percentage at 36 posters

/**
 * Generate HTML page with movie posters in a collage layout
 * @param {Array} movies - Array of movie objects with posterUrl and title
 * @param {string} templateName - Name of the template file (e.g., 'last-chance.html')
 */
function generateCollageHtml(movies, templateName) {
  const templatePath = path.join(
    __dirname,
    "..",
    "..",
    "templates",
    templateName,
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

module.exports = {
  generateCollageHtml,
  POSTER_AREA,
  RADIAL_EXPANSION,
  JITTER_FACTOR,
  MAX_ROTATION_DEG,
  BASE_POSTER_COUNT,
  BASE_POSTER_WIDTH,
};
