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

function minPrice(price = '') {
  return String(price)
    .split('·')[0]
    .split('–')[0]
    .split('-')[0]
    .trim();
}

function sharePrice(price = '') {
  const clean = minPrice(price);
  if (!clean) return '';
  if (/^(od|from|desde|от)\s/i.test(clean)) return clean;
  return `od ${clean}`;
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

  const title = project.title || project.slug;
  const image = firstImage(project);
  const priceText = sharePrice(project.price || '');
  const description = priceText ? `${title} · ${priceText}` : title;
  const shareUrl = `${SITE}/pl/new-developments/share/${project.slug}.html`;
  const finalTargetUrl = targetUrl(project);

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(shareUrl)}">

  <meta property="og:type" content="website">
  <meta property="og:locale" content="pl_PL">
  <meta property="og:site_name" content="Costa Blanca Invest">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:url" content="${esc(image)}">
  <meta property="og:image:secure_url" content="${esc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <meta http-equiv="refresh" content="0; url=${esc(finalTargetUrl)}">
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  <p><a href="${esc(finalTargetUrl)}">Open property</a></p>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, `${project.slug}.html`), html, 'utf8');
}

console.log(`Generated ${projects.length} share pages.`);
