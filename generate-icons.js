const sharp = require("sharp");
const path = require("path");

const SIZES = [192, 512];
const outDir = path.join(__dirname, "public", "icons");

async function generateIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : Math.round(size * 0.05);
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = innerSize / 2;

  // MoneyTracker logo: green circle with $ sign
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${maskable ? "#10b981" : "#0f172a"}" rx="${maskable ? 0 : Math.round(size * 0.2)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.85}" fill="#10b981" ${maskable ? 'opacity="0"' : ""}/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-family="Arial, sans-serif" font-weight="bold" font-size="${Math.round(innerSize * 0.55)}"
      fill="white">$</text>
  </svg>`;

  const suffix = maskable ? "maskable-" : "";
  const filename = `icon-${suffix}${size}x${size}.png`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, filename));
  console.log(`Generated ${filename}`);
}

async function generateAppleIcon() {
  const size = 180;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0f172a" rx="36"/>
    <circle cx="90" cy="90" r="72" fill="#10b981"/>
    <text x="90" y="90" text-anchor="middle" dominant-baseline="central"
      font-family="Arial, sans-serif" font-weight="bold" font-size="88"
      fill="white">$</text>
  </svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, "apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png");
}

(async () => {
  for (const size of SIZES) {
    await generateIcon(size, false);
    await generateIcon(size, true);
  }
  await generateAppleIcon();
  console.log("Done!");
})();
