/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const pngToIco = require("png-to-ico");

async function main() {
  const root = path.join(__dirname, "..");
  const pngPath = path.join(root, "assets", "vivutrade-logo.png");
  const icoPath = path.join(root, "assets", "vivutrade-logo.ico");

  if (!fs.existsSync(pngPath)) {
    throw new Error(`Missing PNG icon: ${pngPath}`);
  }

  const ico = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, ico);
  console.log(`[icon] generated: ${icoPath}`);
}

main().catch((error) => {
  console.error(`[icon] failed: ${error.message || error}`);
  process.exit(1);
});

