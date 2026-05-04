const fs = require('fs');
const path = require('path');

const SITE = 'https://costa-blanca-invest.com';

const projectsPath = path.join(__dirname, '..', 'projects.json');
const outputDir = path.join(__dirname, '..', 'share');

const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

fs.mkdirSync(outputDir, { recursive: true });

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function abs(url) {
  if (!url) return `${SITE}/pl/new-developments/images/new-developments-costa-blanca.jpg`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url.replace(/^\.?\//, '')}`;
}

function firstImage(project) {
  return abs(
    project.shareImage ||
    project.ogImage ||
    project.mainImage ||
    project.image ||
    (Array.isArray(project.images) ? project.images[0] : '')
  );
}

function cleanPrice(project) {
  const value = project.sharePrice || project.price || '';
  return String(value)
    .split('·')[0]
    .trim();
}

function titleWithPrice(project) {
  const title = project.shareTitle || project.title || project.slug;
  const price = cleanPrice(project);

  if (!price) return title;
  if (/^(od|from|desde|от)\s/i.test(price)) return `${title} · ${price}`;

  return `${title} · od ${price}`;
}

function targetUrl(project) {
  if (project.href) {
    if (/^https?:\/\//i.test(project.href)) return project.href;
    return `${SITE}${project.href}`;
  }

  return `${SITE}/pl/new-developments/xml-catalog/?slug=${encodeURIComponent(project.slug)}`;
}

for (const project of projects) {
  if (!project.slug) continue;

  const title = project.shareTitle || project.title || project.slug;
  const pageTitle = titleWithPrice(project);
  const image = firstImage(project);
  const shareUrl = `${SITE}/pl/new-developments/share/${encodeURIComponent(project.slug)}.html`;
  const finalTargetUrl = targetUrl(project);

  const description =
    project.shareDescription ||
    `${pageTitle} | Costa Blanca Invest`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(shareUrl)}">

  <meta property="og:type" content="website">
  <meta property="og:locale" content="pl_PL">
  <meta property="og:site_name" content="Costa Blanca Invest">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:url" content="${esc(image)}">
  <meta property="og:image:secure_url" content="${esc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(pageTitle)}">
  <meta property="og:image:type" content="image/jpeg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <style>
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: #f6f3ee;
      color: #183746;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      width: min(680px, 100%);
      background: #fff;
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 22px 60px rgba(15,23,42,.12);
      border: 1px solid rgba(217,181,109,.22);
    }
    .card img {
      width: 100%;
      height: 360px;
      object-fit: cover;
      display: block;
      background: #e8eef2;
    }
    .body {
      padding: 28px;
    }
    .kicker {
      color: #b89245;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .14em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 34px;
      line-height: 1.05;
      letter-spacing: -.04em;
    }
    .price {
      margin: 0 0 18px;
      color: #b89245;
      font-size: 24px;
      font-weight: 900;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 52px;
      padding: 0 24px;
      border-radius: 999px;
      background: linear-gradient(135deg,#183746,#234e63);
      color: #fff;
      text-decoration: none;
      font-weight: 900;
    }
  </style>
</head>
<body>
  <article class="card">
    <img src="${esc(image)}" alt="${esc(title)}">
    <div class="body">
      <div class="kicker">Costa Blanca Invest</div>
      <h1>${esc(title)}</h1>
      <div class="price">${esc(cleanPrice(project))}</div>
      <a class="btn" href="${esc(finalTargetUrl)}">Zobacz ofertę</a>
    </div>
  </article>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, `${project.slug}.html`), html, 'utf8');
}

console.log(`Generated ${projects.length} share pages.`);
