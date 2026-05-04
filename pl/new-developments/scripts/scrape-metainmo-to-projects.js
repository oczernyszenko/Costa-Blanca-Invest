const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '50');

const projectsPath = path.join(__dirname, '..', 'projects.json');

async function scrape() {
  console.log('🚀 Start scraping...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();

  await page.goto(SOURCE_URL, { waitUntil: 'networkidle2' });

  console.log('⏳ Waiting for content...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const items = await page.evaluate(() => {
    const cards = document.querySelectorAll('.property-item, .item, article');

    return Array.from(cards).map(el => {
      const title =
        el.querySelector('h2, h3, .title')?.innerText?.trim() || 'Property';

      const link =
        el.querySelector('a')?.href || '';

      const img =
        el.querySelector('img')?.src || '';

      return { title, href: link, img };
    }).filter(i => i.href);
  });

  console.log('📊 Found items:', items.length);
  console.log(items.slice(0, 3));

  await browser.close();

  if (!items.length) {
    console.log('❌ No items found → selector issue');
    process.exit(1);
  }

  let existing = [];
  if (fs.existsSync(projectsPath)) {
    existing = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  }

  const existingSlugs = new Set(existing.map(p => p.slug));

  const newItems = [];

  for (let i = 0; i < items.length && newItems.length < LIMIT; i++) {
    const item = items[i];

    if (!item.href) continue;

    const slug = item.href.split('/').filter(Boolean).pop();

    if (!slug || existingSlugs.has(slug)) continue;

    const project = {
      slug,
      title: item.title,
      image: item.img,
      images: [item.img],
      href: `/pl/new-developments/xml-catalog/?slug=${slug}`,
      price: "od 200 000 €",
      priceValue: 200000,
      filterLocation: "alicante",
      meta: "Costa Blanca",
      desc: "Ekskluzywna inwestycja na Costa Blanca — nowoczesna architektura, wysoki standard i potencjał inwestycyjny.",
      chip: "New · Investment",
      params: {
        "Lokalizacja": "Costa Blanca",
        "Typ": "Apartament / Willa",
        "Powierzchnia": "na zapytanie",
        "Pokoje": "różne układy",
        "Cena": "od 200 000 €"
      },
      seoTitle: `${item.title} | Costa Blanca Invest`,
      seoDescription: "Nowa inwestycja na Costa Blanca — pełna galeria, szczegóły i szybki kontakt.",
      seoDescription2: "Idealna oferta pod inwestycję, wakacje lub przeprowadzkę.",
      translations: {
        pl: {
          title: item.title,
          meta: "Costa Blanca",
          price: "od 200 000 €",
          desc: "Nowoczesna inwestycja na Costa Blanca — styl, lokalizacja i potencjał wzrostu.",
          seoDescription: "Nowoczesna inwestycja na Costa Blanca.",
          seoDescription2: "Idealna oferta pod inwestycję."
        },
        en: {
          title: item.title,
          meta: "Costa Blanca",
          price: "from 200,000 €",
          desc: "Modern development on the Costa Blanca — style, location and investment potential.",
          seoDescription: "Modern Costa Blanca development.",
          seoDescription2: "Great for investment or living."
        },
        es: {
          title: item.title,
          meta: "Costa Blanca",
          price: "desde 200.000 €",
          desc: "Promoción moderna en la Costa Blanca — estilo, ubicación y potencial.",
          seoDescription: "Nueva promoción en la Costa Blanca.",
          seoDescription2: "Perfecto para inversión."
        },
        ru: {
          title: item.title,
          meta: "Costa Blanca",
          price: "от 200 000 €",
          desc: "Современный проект на Costa Blanca — стиль, локация и инвестиционный потенциал.",
          seoDescription: "Новая недвижимость на Costa Blanca.",
          seoDescription2: "Отлично для инвестиций."
        }
      }
    };

    newItems.push(project);
  }

  const updated = [...existing, ...newItems];

  fs.writeFileSync(projectsPath, JSON.stringify(updated, null, 2));

  console.log('✅ Added:', newItems.length);
  console.log('📦 Total projects:', updated.length);
}

scrape();
