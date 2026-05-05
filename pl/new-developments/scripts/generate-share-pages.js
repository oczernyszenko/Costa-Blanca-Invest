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
  try {
    const res = await fetch(url);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function createOgImage(project) {
  const imageUrl = abs(project.image || project.images?.[0]);
  const buffer = await downloadImage(imageUrl);

  const width = 1200;
  const height = 630;

  const title = project.title || '';
  const price = (project.price || '').split('·')[0]; // чистим цену

  const svg = `
  <svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.2)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.8)"/>
      </linearGradient>
    </defs>

    <rect width="100%" height="100%" fill="url(#grad)"/>

    <text x="60" y="460" font-size="52" fill="white" font-weight="bold">
      ${esc(title)}
    </text>

    <text x="60" y="540" font-size="46" fill="#D9B56D" font-weight="bold">
      ${esc(price)}
    </text>

    <text x="60" y="80" font-size="28" fill="#ffffff" opacity="0.8">
      Costa Blanca Invest
    </text>
  </svg>
  `;

  const outputPath = path.join(imagesDir, `${project.slug}.jpg`);

  try {
    await sharp(buffer || Buffer.alloc(1200*630*3))
      .resize(width, height)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toFile(outputPath);
  } catch (e) {
    console.log('⚠️ image fallback for', project.slug);
  }

  return `${SITE}/pl/new-developments/share-images/${project.slug}.jpg`;
}

function cleanDescription(text = '') {
  return text
    .replace(/\s+/g,' ')
    .replace(/·.*/,'')
    .trim()
    .slice(0, 160);
}

async function generate() {
  for (const project of projects) {
    try {
      const slug = project.slug;

      const ogImage = await createOgImage(project);

      const shareUrl = `${SITE}/pl/new-developments/share/${slug}.html`;
      const targetUrl = SITE + project.href;

      const title = project.title || 'Costa Blanca Invest';
      const description = cleanDescription(project.seoDescription || project.desc || '');

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
<meta property="og:image:secure_url" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">

<link rel="canonical" href="${shareUrl}">
</head>

<body>

<script>
setTimeout(() => {
  window.location.href = "${targetUrl}";
}, 1200);
</script>

</body>
</html>
`;

      fs.writeFileSync(path.join(shareDir, `${slug}.html`), html);
      console.log(`✅ ${slug}`);
    } catch (e) {
      console.log('❌ error:', project.slug);
    }
  }
}

generate();
