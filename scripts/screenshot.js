const { chromium } = require("playwright");
const path = require("path");
const { getTimestamp } = require("./lib/utils");

/**
 * Take a screenshot of a generated HTML file
 * @param {string} spotlightType - The type of spotlight (e.g., 'last-chance', 'new-films')
 */
async function takeScreenshot(spotlightType) {
  const rootDir = path.join(__dirname, "..");
  const htmlPath = path.join(rootDir, "site", `${spotlightType}.html`);
  const timestamp = getTimestamp();
  const outputPath = path.join(
    rootDir,
    "output",
    `${spotlightType}_${timestamp}.png`,
  );

  console.log(`Opening: ${htmlPath}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set a large viewport to ensure content isn't clipped
  await page.setViewportSize({ width: 1200, height: 1200 });

  // Load the HTML file
  await page.goto(`file://${htmlPath}`);

  // Wait for all poster images to load
  console.log("Waiting for images to load...");
  await page.waitForFunction(
    () => {
      const images = document.querySelectorAll(
        ".poster-item img, .poster-column img",
      );
      return (
        images.length > 0 &&
        Array.from(images).every((img) => img.complete && img.naturalHeight > 0)
      );
    },
    { timeout: 60000 },
  );

  console.log("Images loaded");

  // Wait for web fonts to load
  console.log("Waiting for fonts to load...");
  await page.waitForFunction(() => document.fonts.ready.then(() => true), {
    timeout: 30000,
  });

  // Small extra delay to ensure rendering is complete
  await page.waitForTimeout(500);

  console.log("Fonts loaded");

  // Screenshot the #content element
  const content = await page.$("#content");
  if (content) {
    await content.screenshot({ path: outputPath });
    console.log(`Screenshot saved: ${outputPath}`);
  } else {
    console.error("Could not find #content element");
  }

  await browser.close();
}

// Get spotlight type from command line args, default to 'last-chance'
const spotlightType = process.argv[2] || "last-chance";
takeScreenshot(spotlightType).catch(console.error);
