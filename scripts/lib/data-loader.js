const fs = require("fs");
const path = require("path");

/**
 * Load combined data and ratings from the data directories
 */
function loadData(rootDir) {
  const dataPath = path.join(rootDir, "combined-data", "combined-data.json");
  const imdbPath = path.join(rootDir, "matched-data", "imdb.json");
  const letterboxdPath = path.join(rootDir, "matched-data", "letterboxd.json");
  const rottenTomatoesPath = path.join(
    rootDir,
    "matched-data",
    "rottentomatoes.json",
  );

  console.log(`Reading data from: ${dataPath}`);
  const rawData = fs.readFileSync(dataPath, "utf8");
  const data = JSON.parse(rawData);

  console.log(`Reading IMDB ratings from: ${imdbPath}`);
  const imdbRatings = JSON.parse(fs.readFileSync(imdbPath, "utf8"));

  console.log(`Reading Letterboxd ratings from: ${letterboxdPath}`);
  const letterboxdRatings = JSON.parse(fs.readFileSync(letterboxdPath, "utf8"));

  console.log(`Reading Rotten Tomatoes ratings from: ${rottenTomatoesPath}`);
  const rottenTomatoesRatings = JSON.parse(
    fs.readFileSync(rottenTomatoesPath, "utf8"),
  );

  console.log(`Total movies in data: ${Object.keys(data.movies).length}`);

  return { data, imdbRatings, letterboxdRatings, rottenTomatoesRatings };
}

module.exports = {
  loadData,
};
