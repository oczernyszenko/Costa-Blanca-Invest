const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SITE = 'https://costa-blanca-invest.com';

const projectsPath = path.join(__dirname, '..', 'projects.json');
const shareDir = path.join(__dirname, '..', 'share');
const imagesDir = path.join(__dirname, '..', 'share-images');

const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

fs.mkdirSync(shareDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

function esc(s = '') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;');
}

function abs(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return SITE + url;
}

async function downloadImage(url) {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

async function createOgImage(project) {
  const imageUrl = abs(project.image || project.images?.[0]);
  const buffer = await downloadImage(imageUrl);

  const width = 1200;
  const height = 630;

  const title = project.title || '';
  const price = project.price || '';

  const svg = `
  <svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
      </linearGradient>
    </defs>

    <rect width="100%" height="100%" fill="url(#grad)"/>

    <text x="60" y="440" font-size="56" fill="white" font-weight="700">
      ${esc(title)}
    </text>

    <text x="60" y="520" font-size="48" fill="#D9B56D" font-weight="700">
      ${esc(price)}
    </text>

    <text x="60" y="80" font-size="26" fill="#ffffff" opacity="0.9">
      Costa Blanca Invest
    </text>
  </svg>
  `;

  const outputPath = path.join(imagesDir, `${project.slug}.jpg`);

  await sharp(buffer)
    .resize(width, height)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  return `${SITE}/pl/new-developments/share-images/${project.slug}.jpg`;
}

async function generate() {
  for (const project of projects) {
    const slug = project.slug;

    const ogImage = await createOgImage(project);

    const shareUrl = `${SITE}/pl/new-developments/share/${slug}.html`;
    const targetUrl = SITE + project.href;

    const title = project.title;
    const description = project.seoDescription || project.desc || '';

    const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">

<meta property="og:type" content="website">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ogImage}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">

<link rel="canonical" href="${shareUrl}">
</head>

<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;background:#f6f3ee;">

<a href="${targetUrl}" style="
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:14px 26px;
  border-radius:999px;
  background:#183746;
  color:#fff;
  text-decoration:none;
  font-weight:700;
">
Otwórz ofertę
</a>

<script>
(function(){
  const ua = navigator.userAgent || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot/i.test(ua);

  if (!isBot) {
    setTimeout(() => {
      window.location.href = "${targetUrl}";
    }, 800);
  }
})();
</script>

</body>
</html>
`;

    fs.writeFileSync(path.join(shareDir, `${slug}.html`), html);
    console.log(`✅ ${slug}`);
  }
}

generate();
