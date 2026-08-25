import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve("public/sites/learningseo-io-071dae18");
const theme = "https://learningseo.io/wp-content/themes/learningseo/imgs";

const assets = [
  ["shared/google-sheets.svg", `${theme}/google-sheets.svg`],
  ["shared/share-circle.svg", `${theme}/share-circle.svg`],
  ["shared/twitter-circle-black.svg", `${theme}/twitter-circle-black.svg`],
  ["shared/linkedin-circle-black.svg", `${theme}/linkedin-circle-black.svg`],
  ["shared/threads-circle-black.svg", `${theme}/threads-circle-black.svg`],
  ["shared/lupa.svg", `${theme}/lupa.svg`],
  ["shared/arrow-accordion.svg", `${theme}/arrow-accordion.svg`],
  ["shared/facebook-circle.svg", `${theme}/facebook-circle.svg`],
  ["shared/twitter-circle.svg", `${theme}/twitter-circle.svg`],
  ["shared/instagram-circle.svg", `${theme}/instagram-circle.svg`],
  ["shared/youtube-circle.svg", `${theme}/youtube-circle.svg`],
  ["shared/linkedin-circle.svg", `${theme}/linkedin-circle.svg`],
  ["shared/telegram-circle.svg", `${theme}/telegram-circle.svg`],
  ["shared/tips.png", `${theme}/tips.png`],
  ["shared/favicon-32x32.jpg", "https://learningseo.io/wp-content/uploads/2023/05/cropped-ls-32x32.jpg"],
  ["shared/favicon-192x192.jpg", "https://learningseo.io/wp-content/uploads/2023/05/cropped-ls-192x192.jpg"],
  ["shared/apple-touch-icon.jpg", "https://learningseo.io/wp-content/uploads/2023/05/cropped-ls-180x180.jpg"],
  ["root-8a5edab2/video-01.jpg", "https://learningseo.io/wp-content/uploads/2023/05/learningseo_thumbnail-1024x570.jpg"],
  ["root-8a5edab2/video-02.jpg", "https://img.youtube.com/vi/UwgodddzsmY/hqdefault.jpg"],
  ["root-8a5edab2/video-03.jpg", "https://img.youtube.com/vi/ht-v0gPVTpE/hqdefault.jpg"],
  ["root-8a5edab2/video-04.jpg", "https://img.youtube.com/vi/ldzXH7mo5r4/hqdefault.jpg"],
  ["root-8a5edab2/video-05.jpg", "https://img.youtube.com/vi/5dvfT4Jn4Ko/hqdefault.jpg"],
  ["root-8a5edab2/video-06.jpg", "https://img.youtube.com/vi/nzEySnh20mw/hqdefault.jpg"],
  ["root-8a5edab2/video-07.jpg", "https://img.youtube.com/vi/um6vyaXtAqw/hqdefault.jpg"],
  ["root-8a5edab2/video-08.jpg", "https://img.youtube.com/vi/wk1aTXC2fZ4/hqdefault.jpg"],
  ["root-8a5edab2/video-09.jpg", "https://img.youtube.com/vi/oGdp7KCnmCA/hqdefault.jpg"],
  ["root-8a5edab2/video-10.jpg", "https://img.youtube.com/vi/wPouOKyYPa8/hqdefault.jpg"],
  ["root-8a5edab2/video-11.jpg", "https://img.youtube.com/vi/B_p3Rwaaxas/hqdefault.jpg"],
  ["root-8a5edab2/video-12.jpg", "https://img.youtube.com/vi/mUWR4LpbKQk/hqdefault.jpg"],
  ["root-8a5edab2/video-13.jpg", "https://img.youtube.com/vi/5qfMa5Guhcw/hqdefault.jpg"],
  ["root-8a5edab2/video-14.jpg", "https://img.youtube.com/vi/WS1yDoLUEcQ/hqdefault.jpg"],
  ["root-8a5edab2/video-15.jpg", "https://img.youtube.com/vi/tdxoly2Q1p8/hqdefault.jpg"],
  ["root-8a5edab2/video-16.jpg", "https://img.youtube.com/vi/aoFmavJmknw/hqdefault.jpg"],
  ["root-8a5edab2/video-17.jpg", "https://img.youtube.com/vi/DURD8zWo0PM/hqdefault.jpg"],
  ["root-8a5edab2/video-18.jpg", "https://img.youtube.com/vi/xV9jlyPdcIE/hqdefault.jpg"],
];

async function download([target, url]) {
  const response = await fetch(url);
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || (!type.startsWith("image/") && !type.includes("svg"))) {
    throw new Error(`${response.status} ${type || "unknown type"}: ${url}`);
  }

  const output = resolve(root, target);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  console.log(target);
}

for (let index = 0; index < assets.length; index += 4) {
  await Promise.all(assets.slice(index, index + 4).map(download));
}

console.log(`Downloaded ${assets.length} assets.`);
