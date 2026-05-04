// scrape-metainmo-to-projects.js
// FULL PRO VERSION — БЕЗ ЛИМИТА, ТОЛЬКО РЕАЛЬНЫЕ ФОТО

import fs from "fs";
import fetch from "node-fetch";
import cheerio from "cheerio";

const BASE = "https://spain.metainmo.com/pl/alicante/promociones";

const delay = ms => new Promise(res => setTimeout(res, ms));

const cleanImage = (url) => {
  if (!url) return null;
  if (!/\.(jpg|jpeg|png|webp)/i.test(url)) return null;
  if (/logo|icon|avatar|placeholder|svg/i.test(url)) return null;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://spain.metainmo.com" + url;
  return url;
};

async function getProjectsList() {
  let page = 1;
  let all = [];

  while (true) {
    const url = `${BASE}?page=${page}`;
    console.log("Loading:", url);

    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const items = $(".property-item");

    if (!items.length) break;

    items.each((i, el) => {
      const title = $(el).find(".property-title").text().trim();
      const link = $(el).find("a").attr("href");
      const price = $(el).find(".property-price").text().trim();
      const location = $(el).find(".property-location").text().trim();
      const img = cleanImage($(el).find("img").attr("src"));

      if (!title || !link || !img) return;

      all.push({
        title,
        href: link.startsWith("http") ? link : "https://spain.metainmo.com" + link,
        price,
        meta: location,
        image: img
      });
    });

    page++;
    await delay(500);
  }

  return all;
}

async function getDetails(project) {
  try {
    const res = await fetch(project.href);
    const html = await res.text();
    const $ = cheerio.load(html);

    const desc = $(".property-description").text().trim();

    const images = [];
    $(".gallery img").each((i, el) => {
      const img = cleanImage($(el).attr("src"));
      if (img) images.push(img);
    });

    return {
      ...project,
      desc,
      images: [...new Set(images)],
      slug: project.href.split("/").pop()
    };
  } catch (e) {
    console.log("Error:", project.href);
    return null;
  }
}

async function main() {
  console.log("🚀 START SCRAPE");

  const list = await getProjectsList();
  console.log("Found:", list.length);

  const result = [];

  for (const p of list) {
    const full = await getDetails(p);
    if (!full || !full.images.length) continue;

    result.push(full);
    console.log("✔", full.title);

    await delay(400);
  }

  fs.writeFileSync(
    "./projects.json",
    JSON.stringify(result, null, 2)
  );

  console.log("✅ DONE:", result.length);
}

main();
