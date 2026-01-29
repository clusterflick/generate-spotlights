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

:warning: Ensure fresh data in `combined-data/` and `data-matched/`

```bash
npm run generate
```

**Outputs:**
- `site/last-chance.html` - Visual collage of movie posters
- `output/last-chance-twitter_YYYY-MM-DD_HHMM.txt` - Twitter post with @handles
- `output/last-chance-instagram_YYYY-MM-DD_HHMM.txt` - Instagram post with @handles
- `output/last-chance-generic_YYYY-MM-DD_HHMM.txt` - Generic post without handles

### Take Screenshot

Takes a screenshot of the generated HTML using Playwright.

:warning: Ensure you've previously run `npm run generate`

```bash
npm run screenshot
```

**Outputs:**
- `output/last-chance_YYYY-MM-DD_HHMM.png` - Screenshot of the collage

### Format Code

```bash
npm run format        # Format all files
npm run format:check  # Check formatting without writing
```

## Configuration

Edit constants at the top of `scripts/generate-last-chance.js` to adjust:

- `MIN_IMDB_RATING` - Minimum IMDB rating for collage inclusion
- `MAX_PERFORMANCES` - Maximum showings for a movie to be "last chance"
- `MAX_VENUES` - Maximum venues for a movie to be "last chance"
- `MAX_COLLAGE_MOVIES` - Limit number of posters in collage
- `BASE_POSTER_COUNT` / `BASE_POSTER_WIDTH` - Poster sizing parameters

## GitHub Actions

The workflow runs automatically every Sunday at 9pm UTC, generating content for the upcoming week. It can also be triggered manually.

Artifacts are uploaded:
- `social-media-text` - Twitter, Instagram, and generic text files
- `screenshot` - The PNG image
- `html` - The HTML file
