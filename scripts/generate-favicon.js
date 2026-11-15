/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// High-definition SVG Favicon for Care Circle
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#134e4a" />
      <stop offset="50%" stop-color="#0f4c47" />
      <stop offset="100%" stop-color="#04201e" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eead4" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#2dd4bf" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#0f766e" stop-opacity="0.8" />
    </linearGradient>
    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f0fdfa" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#021413" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- Squircle Base with Rich Teal/Emerald Gradient -->
  <rect width="512" height="512" rx="124" fill="url(#bgGrad)" />

  <!-- Outer Care Ring (representing Circle) -->
  <circle cx="256" cy="256" r="222" fill="none" stroke="url(#ringGrad)" stroke-width="12" />

  <!-- Inner Soft Backdrop Circle -->
  <circle cx="256" cy="256" r="186" fill="#0f4c47" fill-opacity="0.5" />

  <!-- Heart Handshake Icon (Centered and perfectly scaled) -->
  <g transform="translate(82, 82) scale(14.5)" filter="url(#shadow)">
    <path
      d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"
      fill="none"
      stroke="url(#heartGrad)"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>

  <!-- Vitality / AI Sparkle Accent (Top-Right) -->
  <g transform="translate(388, 114) scale(1.5)">
    <path
      d="M0 -12 C1 -4, 4 -1, 12 0 C4 1, 1 4, 0 12 C-1 4, -4 1, -12 0 C-4 -1, -1 -4, 0 -12 Z"
      fill="#2dd4bf"
    />
  </g>
</svg>`;

// Helper function to build a multi-image .ico buffer from an array of PNG buffers
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Image type: 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Image data offset

    offset += img.buffer.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.buffer)]);
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const srcAppDir = path.join(rootDir, "src", "app");
  const publicDir = path.join(rootDir, "public");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write icon.svg to src/app and public
  console.log("Saving SVG icons...");
  fs.writeFileSync(path.join(srcAppDir, "icon.svg"), svg, "utf8");
  fs.writeFileSync(path.join(publicDir, "icon.svg"), svg, "utf8");

  // 2. Render PNG buffers at various sizes
  console.log("Rendering PNG icons...");
  const svgBuffer = Buffer.from(svg);

  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const png64 = await sharp(svgBuffer).resize(64, 64).png().toBuffer();
  const png180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

  // Save Apple Touch Icon and standard PNGs
  fs.writeFileSync(path.join(srcAppDir, "apple-icon.png"), png180);
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), png180);
  fs.writeFileSync(path.join(srcAppDir, "icon.png"), png512);
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), png192);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), png512);

  // 3. Build multi-resolution favicon.ico containing 16x16, 32x32, 48x48
  console.log("Building multi-resolution favicon.ico...");
  const icoBuffer = buildIco([
    { width: 16, height: 16, buffer: png16 },
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 },
    { width: 64, height: 64, buffer: png64 },
  ]);

  fs.writeFileSync(path.join(srcAppDir, "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);

  console.log("Favicons generated successfully!");
}

main().catch((err) => {
  console.error("Failed to generate favicons:", err);
  process.exit(1);
});
