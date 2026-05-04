const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const SITE = 'https://costa-blanca-invest.com';
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '50', 10);

const projectsPath = path.join(__dirname, '..', 'projects.json');

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function clean(text = '') {
  return String(text).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function priceValue(price = '') {
  const match = clean(price).replace(/\s/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function abs(url = '') {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://spain.metainmo.com${url}`;
  return `https://spain.metainmo.com/${url}`;
}

function cityPriority(text = '') {
  const t = text.toLowerCase();
  if (t.includes('alicante')) return 1;
  if (t.includes('san juan')) return 2;
  if (t.includes('mutxamel')) return 3;
  if (t.includes('campello')) return 4;
  if (t.includes('villajoyosa') || t.includes('vila joiosa')) return 5;
  if (t.includes('finestrat')) return 20;
  if (t.includes('benidorm')) return 21;
  if (t.includes('calpe') || t.includes('kalpe')) return 22;
  if (t.includes('torrevieja')) return 40;
  return 99;
}

function makeLead(title, meta, price, type = 'Apartamenty') {
  return {
    pl: [
      `${title} to starannie wybrana nowa inwestycja w lokalizacji ${meta}, przygotowana dla klientów szukających jakości, wygody i dobrego potencjału wartości na Costa Blanca.`,
      `Projekt łączy nowoczesny standard, praktyczne układy i śródziemnomorski styl życia. Cena ${price} sprawia, że oferta może być interesująca zarówno dla klienta prywatnego, jak i inwestora.`,
      `W tej lokalizacji ważne są nie tylko parametry nieruchomości, ale również dostęp do usług, plaż, infrastruktury oraz płynność przyszłej odsprzedaży.`,
      `${type} w tym segmencie dobrze sprawdza się jako second home, baza wakacyjna lub zakup z myślą o wynajmie i długoterminowym wzroście wartości.`
    ],
    en: [
      `${title} is a carefully selected new development in ${meta}, suitable for buyers looking for quality, comfort and long-term value potential on the Costa Blanca.`,
      `The project combines a modern standard, practical layouts and a Mediterranean lifestyle. With prices at ${price}, it may be attractive both for private buyers and investors.`,
      `In this location, the key factors are not only property specifications, but also access to services, beaches, infrastructure and future resale liquidity.`,
      `${type} in this segment can work well as a second home, holiday base or investment purchase focused on rental and long-term value growth.`
    ],
    es: [
      `${title} es una promoción seleccionada en ${meta}, pensada para compradores que buscan calidad, comodidad y potencial de valor en la Costa Blanca.`,
      `El proyecto combina estándar moderno, distribuciones prácticas y estilo de vida mediterráneo. Con precio ${price}, puede ser interesante para uso privado o inversión.`,
      `En esta ubicación importan no solo los parámetros de la vivienda, sino también el acceso a servicios, playas, infraestructura y liquidez futura.`,
      `${type} en este segmento puede funcionar como segunda residencia, base vacacional o compra orientada al alquiler y a la revalorización.`
    ],
    ru: [
      `${title} — тщательно выбранный новый проект в локации ${meta}, подходящий покупателям, которые ищут качество, комфорт и потенциал роста стоимости на Costa Blanca.`,
      `Проект сочетает современный стандарт, практичные планировки и средиземноморский стиль жизни. Цена ${price} делает предложение интересным как для личного использования, так и для инвестиций.`,
      `В этой локации важны не только параметры объекта, но и доступ к сервисам, пляжам, инфраструктуре и ликвидность при будущей продаже.`,
      `${type} в этом сегменте может подойти как второй дом, база для отдыха или инвестиционная покупка под аренду и рост стоимости.`
    ]
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 Costa Blanca Invest Importer' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function extractProjects(html) {
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>\s*Nowa inwestycja\s+([^<]+?)\s+promocja w\s+([^<]+?)<\/a>/gi;
  const matches = [...html.matchAll(linkRegex)];

  const projects = [];

  for (let i = 0; i < matches.length; i++) {
    const [full, hrefRaw, nameRaw, cityRaw] = matches[i];
    if (/xxxxxxxx/i.test(full + nameRaw)) continue;

    const start = matches[i].index;
    const end = matches[i + 1]?.index || html.length;
    const block = html.slice(start, end);

    const title = clean(nameRaw);
    const city = clean(cityRaw);
    const url = abs(hrefRaw);

    const text = clean(block.replace(/<[^>]+>/g, ' '));
    const priceMatch = text.match(/(?:od\s*)?[\d\s]{3,}\s*€/i);
    const price = priceMatch ? clean(priceMatch[0]) : 'na zapytanie';

    const locationMatch = text.match(/Alicante,\s*([^*]+?)(?:Rok oddania|Stan|Pozwolenie|m2|Nieruchomość|$)/i);
    const meta = locationMatch ? clean(`Alicante, ${locationMatch[1]}`) : `Alicante, ${city}`;

    const areaMatch = text.match(/m2 zabudowane:\s*([\d.,]+\s*m²)/i) || text.match(/m2 zabudowane\s*([\d.,]+\s*m²)/i);
    const area = areaMatch ? clean(areaMatch[1]) : 'na zapytanie';

    const roomsMatch = text.match(/(\d+)-pokojowe/i);
    const rooms = roomsMatch ? `${roomsMatch[1]} pokoje` : 'różne układy';

    const imgMatches = [...block.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m => abs(m[1]));
    const images = [...new Set(imgMatches)].filter(Boolean);
    const image = images[0] || '';

    projects.push({
      title,
      city,
      url,
      price,
      meta,
      area,
      rooms,
      image,
      images,
      priority: cityPriority(`${meta} ${title}`)
    });
  }

  return projects.sort((a, b) => a.priority - b.priority);
}

function toProject(raw) {
  const baseSlug = slugify(raw.title);
  const slug = baseSlug || slugify(raw.url);
  const lead = makeLead(raw.title, raw.meta, raw.price, 'Apartamenty');

  return {
    slug,
    title: raw.title,
    shareTitle: raw.title,
    sharePrice: raw.price === 'na zapytanie' ? raw.price : `od ${raw.price.replace(/^od\s+/i, '')}`,
    shareDescription: `${raw.title} · ${raw.price}`,
    shareImage: raw.image,
    image: raw.image,
    images: raw.images.length ? raw.images : [raw.image].filter(Boolean),
    href: `/pl/new-developments/xml-catalog/?slug=${slug}`,
    sourceUrl: raw.url,
    price: raw.price,
    priceValue: priceValue(raw.price),
    filterLocation: slugify(raw.city || raw.meta).split('-')[0] || 'alicante',
    meta: raw.meta,
    desc: `${raw.title} — wybrana nowa inwestycja na Costa Blanca z potencjałem do życia, wypoczynku i inwestycji.`,
    chip: 'Nowa inwestycja · Costa Blanca',
    params: {
      Lokalizacja: raw.meta,
      Typ: 'Apartamenty / Wille',
      Powierzchnia: raw.area,
      Pokoje: raw.rooms,
      Cena: raw.price
    },
    seoTitle: `${raw.title} | Costa Blanca Invest`,
    seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Nowa inwestycja Costa Blanca Invest z galerią, parametrami i szybkim kontaktem.`,
    seoDescription2: 'Oferta przygotowana w stylu Costa Blanca Invest — z naciskiem na lokalizację, jakość, lifestyle i potencjał inwestycyjny.',
    translations: {
      pl: { title: raw.title, meta: raw.meta, price: raw.price, desc: `${raw.title} — nowa inwestycja na Costa Blanca.`, seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}`, seoDescription2: lead.pl[1], lead: lead.pl },
      en: { title: raw.title, meta: raw.meta, price: raw.price, desc: `${raw.title} — new development on the Costa Blanca.`, seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}`, seoDescription2: lead.en[1], lead: lead.en },
      es: { title: raw.title, meta: raw.meta, price: raw.price, desc: `${raw.title} — nueva promoción en la Costa Blanca.`, seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}`, seoDescription2: lead.es[1], lead: lead.es },
      ru: { title: raw.title, meta: raw.meta, price: raw.price, desc: `${raw.title} — новый проект на Costa Blanca.`, seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}`, seoDescription2: lead.ru[1], lead: lead.ru }
    },
    seoContent: lead,
    lead: lead.pl
  };
}

async function main() {
  console.log('Fetching Metainmo...');
  const html = await fetchHtml(SOURCE_URL);

  const current = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const existingSlugs = new Set(current.map(p => p.slug));

  const rawProjects = extractProjects(html);
  console.log('Found public projects:', rawProjects.length);

  const imported = [];

  for (const raw of rawProjects) {
    const project = toProject(raw);
    if (!project.title || !project.price || existingSlugs.has(project.slug)) continue;
    imported.push(project);
    existingSlugs.add(project.slug);
    if (imported.length >= LIMIT) break;
  }

  const updated = [...current, ...imported];
  fs.writeFileSync(projectsPath, JSON.stringify(updated, null, 2), 'utf8');

  console.log('Added:', imported.length);
  console.log('Total:', updated.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
