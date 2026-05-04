const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '50');

const projectsPath = path.join(__dirname, '..', 'projects.json');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'networkidle2' });

  // ждём карточки
  await page.waitForSelector('.property-card');

  const data = await page.evaluate(() => {
    const items = [];

    document.querySelectorAll('.property-card').forEach(el => {
      const title = el.querySelector('.title')?.innerText || 'New Project';
      const price = el.querySelector('.price')?.innerText || '';
      const image = el.querySelector('img')?.src || '';

      items.push({
        title,
        price,
        image
      });
    });

    return items;
  });

  console.log('FOUND:', data.length);

  const sliced = data.slice(0, LIMIT);

  const formatted = sliced.map((p, i) => ({
    slug: `import-${i}-${Date.now()}`,
    title: p.title,
    image: p.image,
    price: p.price,
    desc: "Ekskluzywna inwestycja na Costa Blanca — design, lokalizacja i potencjał inwestycyjny.",
    priceValue: 0,
    filterLocation: "alicante",
    meta: "Costa Blanca",
    href: "#"
  }));

  let existing = [];
  if (fs.existsSync(projectsPath)) {
    existing = JSON.parse(fs.readFileSync(projectsPath));
  }

  const merged = [...formatted, ...existing];

  fs.writeFileSync(projectsPath, JSON.stringify(merged, null, 2));

  console.log('Saved:', formatted.length);

  await browser.close();
})();
