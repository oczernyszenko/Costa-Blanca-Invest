const fs = require('fs');
const path = require('path');

// путь к projects.json
const projectsPath = path.join(__dirname, '..', 'projects.json');

// куда сохраняем share страницы
const outputDir = path.join(__dirname, '..', 'share');

// читаем данные
const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

// создаём папку /share если нет
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// шаблон страницы (ВАЖНО — это редирект на твой template)
function createPage(slug) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Loading...</title>

  <!-- 🔥 ВАЖНО ДЛЯ FACEBOOK -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://costa-blanca-invest.com/pl/new-developments/share/${slug}.html">

  <!-- минимально (остальное подтянет template) -->
  <meta property="og:title" content="Costa Blanca Invest">
  <meta property="og:description" content="Property offer">
  
  <!-- редирект -->
  <meta http-equiv="refresh" content="0; url=/pl/new-developments/xml-catalog/?slug=${slug}">
</head>

<body>
  Redirecting...
</body>
</html>`;
}

// создаём страницы
projects.forEach(project => {
  if (!project.slug) return;

  const filePath = path.join(outputDir, `${project.slug}.html`);
  fs.writeFileSync(filePath, createPage(project.slug));
});

console.log('✅ Share pages generated!');
