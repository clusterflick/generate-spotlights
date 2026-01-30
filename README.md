# Generate Spotlights

Scripts for generating social media content for Clusterflick.

## Directory Structure

```
generate-spotlights/
├── assets/              # Static assets (icons, images)
├── combined-data/       # Input: combined movie data
├── data-matched/        # Input: IMDB ratings data
├── output/              # Generated text files and screenshots (gitignored)
├── scripts/             # Node.js scripts
├── site/                # Generated HTML files (gitignored)
└── templates/           # HTML templates
```

## Setup

```bash
npm install
npx playwright install chromium
```

## Scripts

### Generate Last Chance Content

Generates a "Last Chance" collage and social media text for movies ending this week.

:warning: Ensure fresh data in `combined-data/` and `matched-data/`

```bash
npm run generate:last-chance
```

**Collage filters:**
- Last performance is before end of this week (Sunday 23:59)
- Has upcoming performances
- Feature-length film (≥60 minutes)
- Not in "Uncategorised" genre
- Has a poster image
- Has actors listed
- IMDB rating ≥ 5
- Maximum 4 upcoming performances (excludes widely available films)
- Maximum 2 venues (excludes blockbusters)

**Outputs:**
- `site/last-chance.html` - Visual collage of movie posters
- `output/last-chance-twitter_YYYY-MM-DD_HHMM.txt` - Twitter post with @handles
- `output/last-chance-instagram_YYYY-MM-DD_HHMM.txt` - Instagram post with @handles
- `output/last-chance-generic_YYYY-MM-DD_HHMM.txt` - Generic post without handles

### Generate New Films Content

Generates a "New Films" collage and social media text for movies newly added this week.

:warning: Ensure fresh data in `combined-data/` and `matched-data/`

```bash
npm run generate:new-films
```

**Collage filters:**
- First seen this week (since Monday 00:00)
- Has upcoming performances
- Feature-length film (≥60 minutes)
- Not in "Uncategorised" genre
- Has a poster image
- Has actors listed
- IMDB rating ≥ 5

**Outputs:**
- `site/new-films.html` - Visual collage of movie posters
- `output/new-films-twitter_YYYY-MM-DD_HHMM.txt` - Twitter post with @handles
- `output/new-films-instagram_YYYY-MM-DD_HHMM.txt` - Instagram post with @handles
- `output/new-films-generic_YYYY-MM-DD_HHMM.txt` - Generic post without handles

### Generate Single Movie Spotlight

Generates a spotlight for a single movie, featuring a large poster with title and venue information.

:warning: Ensure fresh data in `combined-data/` and `matched-data/`

```bash
npm run generate:single-movie -- <TMDB_ID>
```

**Example:**
```bash
npm run generate:single-movie -- 550
```

**Features:**
- Large poster with title displayed below
- Venue list showing where the movie is playing
- Automatic venue grouping when more than 7 venues (e.g., "12 Cineworlds")
- Duration calculation (e.g., "Now showing for the next month")
- Movie details: title, year, director, and synopsis

**Outputs:**
- `site/single-movie.html` - Visual spotlight with poster and title
- `output/single-movie_YYYY-MM-DD_HHMM.txt` - Social media text with movie details

### Take Screenshot

Takes a screenshot of the generated HTML using Playwright.

:warning: Ensure you've previously run the generate script for the spotlight type

```bash
npm run screenshot:last-chance
npm run screenshot:new-films
npm run screenshot:single-movie
```

**Outputs:**
- `output/last-chance_YYYY-MM-DD_HHMM.png` - Screenshot of the Last Chance collage
- `output/new-films_YYYY-MM-DD_HHMM.png` - Screenshot of the New Films collage
- `output/single-movie_YYYY-MM-DD_HHMM.png` - Screenshot of the Single Movie spotlight

### Format Code

```bash
npm run format        # Format all files
npm run format:check  # Check formatting without writing
```

## Configuration

Edit constants at the top of the generate scripts to adjust:

**Last Chance** (`scripts/generate-last-chance.js`):
- `MIN_IMDB_RATING` - Minimum IMDB rating for collage inclusion
- `MAX_PERFORMANCES` - Maximum showings for a movie to be "last chance"
- `MAX_VENUES` - Maximum venues for a movie to be "last chance"
- `MAX_COLLAGE_MOVIES` - Limit number of posters in collage

**New Films** (`scripts/generate-new-films.js`):
- `MIN_IMDB_RATING` - Minimum IMDB rating for collage inclusion
- `MAX_COLLAGE_MOVIES` - Limit number of posters in collage

**Collage Layout** (`scripts/lib/collage.js`):
- `BASE_POSTER_COUNT` / `BASE_POSTER_WIDTH` - Poster sizing parameters

## GitHub Actions

### Scheduled Workflows

The Last Chance and New Films workflows run automatically every Sunday at 9pm UTC, generating content for the upcoming week. They can also be triggered manually.

### Single Movie Workflow

The Single Movie workflow is triggered manually only. Go to Actions → "Generate Single Movie Spotlight" → "Run workflow" and enter a TMDB ID.

### Artifacts

All workflows upload artifacts:
- `social-media-text` - Text files for social media posts
- `screenshot` - The PNG image
- `html` - The HTML file
