const fs = require("fs");
const path = require("path");

/**
 * Load combined data and IMDB ratings from the data directories
 */
function loadData(rootDir) {
  const dataPath = path.join(rootDir, "combined-data", "combined-data.json");
  const imdbPath = path.join(rootDir, "matched-data", "imdb.json");

  console.log(`Reading data from: ${dataPath}`);
  const rawData = fs.readFileSync(dataPath, "utf8");
  const data = JSON.parse(rawData);

  console.log(`Reading IMDB ratings from: ${imdbPath}`);
  const imdbRatings = JSON.parse(fs.readFileSync(imdbPath, "utf8"));

  console.log(`Total movies in data: ${Object.keys(data.movies).length}`);

  return { data, imdbRatings };
}

module.exports = {
  loadData,
};
