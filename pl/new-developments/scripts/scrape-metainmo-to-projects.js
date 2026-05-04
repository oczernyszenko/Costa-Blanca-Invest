const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '50', 10);

const projectsPath = path.join(__dirname, '..', 'projects.json');

function clean(v = '') {
  return String(v)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(v = '') {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function abs(url = '') {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://spain.metainmo.com${url}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  return await res.text();
}

function extractLinks(html) {
  const links = new Set();
  const re = /href="([^"]+)"/g;
  let m;

  while ((m = re.exec(html))) {
    const url = abs(m[1]);

    if (url.includes('/promocion') || url.includes('/inmueble')) {
      links.add(url);
    }
  }

  return [...links];
}

function extractImages(html) {
  const imgs = [];
  const re = /<img[^>]+src="([^"]+)"/g;
  let m;

  while ((m = re.exec(html))) {
    const url = abs(m[1]);

    if (url.includes('jpg') || url.includes('png')) {
      imgs.push(url);
    }
  }

  return [...new Set(imgs)].slice(0, 10);
}

function extractTitle(html) {
  const m = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return m ? clean(m[1]) : 'New Development Costa Blanca';
}

function extractPrice(html) {
  const m = html.match(/[\d\s]+€/);
  return m ? clean(m[0]) : 'na zapytanie';
}

async function parseProject(url) {
  const html = await fetchHtml(url);

  const title = extractTitle(html);
  const price = extractPrice(html);
  const images = extractImages(html);

  if (!images.length) return null;

  return {
    slug: slugify(title),
    title,
    price,
    image: images[0],
    images,
    href: `/pl/new-developments/xml-catalog/?slug=${slugify(title)}`
  };
}

async function main() {
  console.log('Fetching list...');
  const html = await fetchHtml(SOURCE_URL);

  const links = extractLinks(html);
  console.log('Found links:', links.length);

  const current = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const existing = new Set(current.map(p => p.slug));

  const added = [];

  for (const url of links) {
    if (added.length >= LIMIT) break;

    try {
      const p = await parseProject(url);
      if (!p) continue;
      if (existing.has(p.slug)) continue;

      added.push(p);
      existing.add(p.slug);

      console.log('Added:', p.title);
    } catch (e) {
      console.log('Skip:', url);
    }
  }

  const updated = [...current, ...added];

  fs.writeFileSync(projectsPath, JSON.stringify(updated, null, 2));

  console.log('TOTAL ADDED:', added.length);
}

main();
