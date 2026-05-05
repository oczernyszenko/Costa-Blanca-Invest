const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SITE = 'https://costa-blanca-invest.com';
const BASE_PATH = '/pl/new-developments';

const projectsPath = path.join(__dirname, '..', 'projects.json');
const shareDir = path.join(__dirname, '..', 'share');
const imagesDir = path.join(__dirname, '..', 'share-images');

const WIDTH = 1200;
const HEIGHT = 630;

fs.mkdirSync(shareDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function abs(url = '') {
  if (!url) return '';
  const clean = String(url).trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith('/')) return SITE + clean;
  return `${SITE}/${clean.replace(/^\.\//, '')}`;
}

function cleanText(value = '', limit = 180) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function cleanPrice(value = '') {
  return String(value || '')
    .split('·')[0]
    .trim();
}

function getTranslated(project, lang = 'pl') {
  return project?.translations?.[lang] || project?.translations?.pl || {};
}

function isBadCategoryImage(url = '') {
  const u = String(url).toLowerCase();
  return (
    !u ||
    u.includes('new-developments-costa-blanca') ||
    u.includes('/images/new-developments') ||
    u.includes('/share-images/') ||
    u.includes('category') ||
    u.includes('catalog') ||
    u.includes('placeholder') ||
    u.includes('default') ||
    u.endsWith('.svg')
  );
}

function collectImageUrlsDeep(value, out = []) {
  if (!value) return out;

  if (typeof value === 'string') {
    const clean = value.trim();
    if (clean.match(/[.](jpg|jpeg|png|webp)([?#]|$)/i) || clean.startsWith('http')) {
      out.push(clean);
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrlsDeep(item, out));
    return out;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectImageUrlsDeep(item, out));
  }

  return out;
}

function imageCandidates(project) {
  const tr = getTranslated(project, 'pl');
  const values = [];

  const push = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === 'object') {
      collectImageUrlsDeep(value).forEach(push);
      return;
    }
    if (typeof value === 'string' && value.trim()) values.push(value.trim());
  };

  push(project.shareImage);
  push(project.ogImage);
  push(project.mainImage);
  push(project.heroImage);
  push(project.cardImage);
  push(project.previewImage);
  push(project.coverImage);
  push(project.thumbnail);

  push(tr.shareImage);
  push(tr.ogImage);
  push(tr.mainImage);
  push(tr.heroImage);
  push(tr.cardImage);
  push(tr.previewImage);
  push(tr.coverImage);
  push(tr.thumbnail);

  Object.keys(project)
    .filter((key) => new RegExp('^image[_-]?[0-9]+$', 'i').test(key))
    .sort((a, b) => {
      const an = Number((a.match(/[0-9]+/) || ['0'])[0]);
      const bn = Number((b.match(/[0-9]+/) || ['0'])[0]);
      return an - bn;
    })
    .forEach((key) => push(project[key]));

  push(project.images);
  push(project.gallery);
  push(project.photos);
  push(project.media);
  push(project.pictures);

  collectImageUrlsDeep(project).forEach(push);

  push(project.image);

  const seen = new Set();
  return values
    .map(abs)
    .filter(Boolean)
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function getBestImage(project) {
  const candidates = imageCandidates(project);
  const real = candidates.filter((url) => !isBadCategoryImage(url));

  const preferred =
    real.find((url) => /metainmo|digitaloceanspaces|uploads|cdn|storage/i.test(url)) ||
    real.find((url) => url.includes(`${BASE_PATH}/`) && !url.includes('/share-images/')) ||
    real[0];

  return preferred || `${SITE}${BASE_PATH}/images/new-developments-costa-blanca.jpg`;
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Costa Blanca Invest OG Image Generator',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Image HTTP ${response.status}: ${url}`);
  }

  const type = response.headers.get('content-type') || '';
  if (!type.includes('image')) {
    throw new Error(`URL is not image: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function svgText(value, maxLength = 58) {
  const text = cleanText(value, maxLength);
  return esc(text);
}

function makeOgOverlay({ title, price, meta }) {
  const safeTitle = svgText(title, 48);
  const safePrice = svgText(cleanPrice(price), 42);
  const safeMeta = svgText(meta, 78);

  return Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.00"/>
      <stop offset="50%" stop-color="#000000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.44"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff4c7"/>
      <stop offset="100%" stop-color="#d9b56d"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.30"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#shade)"/>

  <rect x="58" y="396" width="270" height="46" rx="23" fill="#000000" fill-opacity="0.24" stroke="#ffffff" stroke-opacity="0.24"/>
  <text x="82" y="427" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="5" fill="#ffffff">COSTA BLANCA INVEST</text>

  <text x="60" y="510" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="900" fill="#ffffff" filter="url(#shadow)">${safeTitle}</text>
  <text x="60" y="570" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="url(#gold)" filter="url(#shadow)">${safePrice}</text>
  <text x="60" y="610" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#ffffff" fill-opacity="0.92" filter="url(#shadow)">${safeMeta}</text>
</svg>`);
}

async function createFallbackImage(outputPath, project) {
  const tr = getTranslated(project, 'pl');
  const title = tr.title || project.title || project.slug || 'Costa Blanca Invest';
  const price = tr.price || project.price || '';
  const meta = tr.meta || tr.subtitle || project.meta || project.location || '';

  const bg = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#183746"/>
      <stop offset="55%" stop-color="#234e63"/>
      <stop offset="100%" stop-color="#d9b56d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
</svg>`);

  await sharp(bg)
    .composite([{ input: makeOgOverlay({ title, price, meta }), top: 0, left: 0 }])
    .jpeg({ quality: 92, progressive: true })
    .toFile(outputPath);
}

async function createOgImage(project) {
  const slug = project.slug;
  const tr = getTranslated(project, 'pl');
  const title = tr.title || project.title || slug || 'Costa Blanca Invest';
  const price = tr.price || project.price || '';
  const meta = tr.meta || tr.subtitle || project.meta || project.location || 'Costa Blanca';
  const imageUrl = getBestImage(project);
  const outputPath = path.join(imagesDir, `${slug}.jpg`);

  try {
    const imageBuffer = await downloadImage(imageUrl);

    await sharp(imageBuffer)
      .rotate()
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
      .modulate({ brightness: 1.04, saturation: 1.02 })
      .composite([{ input: makeOgOverlay({ title, price, meta }), top: 0, left: 0 }])
      .jpeg({ quality: 92, progressive: true })
      .toFile(outputPath);

    console.log(`🖼️  ${slug}: ${imageUrl}`);
  } catch (error) {
    console.warn(`⚠️  Image failed for ${slug}: ${error.message}`);
    await createFallbackImage(outputPath, project);
  }

  return `${SITE}${BASE_PATH}/share-images/${slug}.jpg`;
}

function buildTargetUrl(project) {
  if (project.href) {
    if (/^https?:\/\//i.test(project.href)) return project.href;
    return SITE + project.href;
  }
  return `${SITE}${BASE_PATH}/xml-catalog/?slug=${encodeURIComponent(project.slug)}`;
}

function botSafeRedirectScript(targetUrl) {
  const safeTarget = JSON.stringify(targetUrl);
  return `
<script>
(function () {
  var ua = navigator.userAgent || '';
  var isBot = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot/i.test(ua);
  if (!isBot) {
    setTimeout(function () {
      window.location.href = ${safeTarget};
    }, 900);
  }
})();
</script>`;
}

function buildShareHtml(project, ogImage) {
  const slug = project.slug;
  const tr = getTranslated(project, 'pl');
  const title = cleanText(tr.title || project.title || slug || 'Costa Blanca Invest', 90);
  const price = cleanPrice(tr.price || project.price || '');
  const meta = cleanText(tr.meta || tr.subtitle || project.meta || project.location || '', 100);
  const description = cleanText(
    tr.seoDescription ||
    project.seoDescription ||
    tr.desc ||
    project.desc ||
    [title, price, meta].filter(Boolean).join(' · '),
    160
  );

  const shareUrl = `${SITE}${BASE_PATH}/share/${slug}.html`;
  const targetUrl = buildTargetUrl(project);

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${shareUrl}">
<link rel="image_src" href="${ogImage}">

<meta property="og:type" content="website">
<meta property="og:locale" content="pl_PL">
<meta property="og:site_name" content="Costa Blanca Invest">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:url" content="${ogImage}">
<meta property="og:image:secure_url" content="${ogImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)} — Costa Blanca Invest">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">

<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#183746}
  .card{max-width:720px;margin:24px;padding:26px;border-radius:28px;background:#fff;box-shadow:0 22px 60px rgba(15,23,42,.12);text-align:center}
  img{width:100%;border-radius:22px;display:block;margin-bottom:18px}
  h1{margin:0 0 10px;font-size:32px;line-height:1.1}
  p{margin:0 0 18px;color:#62707c;font-size:18px}
  a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background:#183746;color:#fff;text-decoration:none;font-weight:800}
</style>
</head>
<body>
  <main class="card">
    <img src="${ogImage}" alt="${esc(title)}">
    <h1>${esc(title)}</h1>
    <p>${esc([price, meta].filter(Boolean).join(' · '))}</p>
    <a href="${targetUrl}">Otwórz ofertę</a>
  </main>
  ${botSafeRedirectScript(targetUrl)}
</body>
</html>`;
}

async function generate() {
  let ok = 0;
  let failed = 0;

  for (const project of projects) {
    if (!project || !project.slug) {
      console.warn('⚠️  Skip project without slug');
      continue;
    }

    try {
      const ogImage = await createOgImage(project);
      const html = buildShareHtml(project, ogImage);
      fs.writeFileSync(path.join(shareDir, `${project.slug}.html`), html, 'utf8');
      console.log(`✅ ${project.slug}`);
      ok += 1;
    } catch (error) {
      console.error(`❌ ${project.slug}: ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. Generated: ${ok}. Failed: ${failed}.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

generate();
