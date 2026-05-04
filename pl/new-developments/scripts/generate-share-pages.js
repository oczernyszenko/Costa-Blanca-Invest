const fs = require('fs');
const path = require('path');

const projectsPath = path.join(__dirname, '..', 'projects.json');
const outputDir = path.join(__dirname, '..', 'share');

const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

projects.forEach(project => {
  const slug = project.slug;
  if (!slug) return;

  const filePath = path.join(outputDir, `${slug}.html`);

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">

<title>${project.title}</title>

<meta property="og:title" content="${project.title}">
<meta property="og:description" content="${project.title} · od ${project.price}">
<meta property="og:image" content="https://costa-blanca-invest.com${project.shareImage || project.image}">
<meta property="og:url" content="https://costa-blanca-invest.com/pl/new-developments/share/${slug}.html">
<meta property="og:type" content="website">

<meta name="twitter:card" content="summary_large_image">

<script>
window.location.href = "/pl/new-developments/xml-catalog/?slug=${slug}";
</script>

</head>
<body></body>
</html>`;

  fs.writeFileSync(filePath, html);
});

console.log('Share pages generated');
