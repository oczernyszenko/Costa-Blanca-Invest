const fs = require('fs');
const path = require('path');

// путь к projects.json
const projectsPath = path.join(__dirname, '..', 'projects.json');

// папка для share страниц
const outputDir = path.join(__dirname, '..', 'share');

// базовый домен
const BASE_URL = 'https://costa-blanca-invest.com';

// читаем проекты
const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

// создаём папку /share если нет
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// генерация страниц
projects.forEach(project => {
  const slug = project.slug;

  const shareUrl = `${BASE_URL}/pl/new-developments/share/${slug}.html`;
  const targetUrl = `${BASE_URL}${project.href}`;

  const title = project.title || '';
  const description = project.seoDescription || project.desc || '';
  const image = project.image?.startsWith('http')
    ? project.image
    : `${BASE_URL}${project.image}`;

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${title}</title>
<meta name="description" content="${description}">

<!-- OG -->
<meta property="og:type" content="website">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- WhatsApp -->
<meta property="og:site_name" content="Costa Blanca Invest">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">

<!-- ВАЖНО: canonical = share URL -->
<link rel="canonical" href="${shareUrl}">

<style>
  body {
    font-family: Arial, sans-serif;
    background: #fff;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
</style>
</head>

<body>

<script>
  // мягкий редирект (Facebook успевает считать OG)
  setTimeout(() => {
    window.location.href = "${targetUrl}";
  }, 200);
</script>

</body>
</html>
`;

  fs.writeFileSync(
    path.join(outputDir, `${slug}.html`),
    html.trim()
  );

  console.log(`✅ Created: ${slug}.html`);
});

console.log('🚀 Share pages generated successfully!');
