const { chromium } = require("playwright");
const path = require("path");

async function takeScreenshot() {
  const rootDir = path.join(__dirname, "..");
  const htmlPath = path.join(rootDir, "site", "last-chance.html");
  const outputPath = path.join(rootDir, "output", "last-chance.png");

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
      const images = document.querySelectorAll(".poster-item img");
      return (
        images.length > 0 &&
        Array.from(images).every((img) => img.complete && img.naturalHeight > 0)
      );
    },
    { timeout: 60000 },
  );

  // Small extra delay to ensure rendering is complete
  await page.waitForTimeout(500);

  console.log("Images loaded");

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

takeScreenshot().catch(console.error);
