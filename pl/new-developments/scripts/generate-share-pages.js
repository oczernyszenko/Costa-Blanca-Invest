const fs = require('fs');
const path = require('path');

const projects = require('../pl/new-developments/projects.json');

const outputDir = path.join(__dirname, '../pl/new-developments/share');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

projects.forEach(project => {
  if (!project.slug) return;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>${project.title}</title>

<meta property="og:title" content="${project.title}">
<meta property="og:description" content="${project.price || ''}">
<meta property="og:image" content="${project.image || ''}">
<meta property="og:url" content="https://costa-blanca-invest.com/pl/new-developments/share/${project.slug}.html">

<meta name="twitter:card" content="summary_large_image">
</head>

<body>
<script>
window.location.href = "/pl/new-developments/xml-catalog/?slug=${project.slug}";
</script>
</body>
</html>`;

  fs.writeFileSync(
    path.join(outputDir, `${project.slug}.html`),
    html
  );
});

console.log('Share pages generated');
