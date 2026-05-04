const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '50', 10);

const projectsPath = path.join(__dirname, '..', 'projects.json');

function clean(v = '') {
  return String(v)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(v = '') {
  return clean(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function priceValue(price = '') {
  const n = clean(price).replace(/\s/g, '').match(/\d+/);
  return n ? Number(n[0]) : 0;
}

function abs(url = '') {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://spain.metainmo.com${url}`;
  return `https://spain.metainmo.com/${url}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 Costa Blanca Invest Importer'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.text();
}

function getMeta(html, property) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? clean(m[1]) : '';
}

function extractListLinks(html) {
  const links = new Map();

  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = abs(m[1]);
    const text = clean(m[2]);

    if (!href.includes('spain.metainmo.com')) continue;
    if (!/promoc/i.test(href) && !/obra|inmueble|property|promocion/i.test(href)) continue;
    if (!/nowa inwestycja|promocja|alicante|benidorm|finestrat|calpe|villajoyosa|mutxamel|campello/i.test(text + href)) continue;
    if (/xxxxxxxx/i.test(text)) continue;

    links.set(href, href);
  }

  return [...links.values()];
}

function extractImages(html) {
  const urls = [];

  const imgRe = /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi;
  let m;

  while ((m = imgRe.exec(html))) {
    const url = abs(m[1]);

    if (!url) continue;
    if (/logo|avatar|favicon|placeholder|svg|base64/i.test(url)) continue;
    if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) continue;

    urls.push(url);
  }

  const sourceRe = /<source[^>]+srcset=["']([^"']+)["']/gi;
  while ((m = sourceRe.exec(html))) {
    const first = m[1].split(',')[0].trim().split(' ')[0];
    const url = abs(first);

    if (url && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
      urls.push(url);
    }
  }

  return [...new Set(urls)].slice(0, 12);
}

function extractPrice(html) {
  const text = clean(html);
  const m =
    text.match(/(?:od\s*)?[\d\s]{3,}\s*€/i) ||
    text.match(/[\d\s]{3,}\s*EUR/i);

  return m ? clean(m[0]) : 'na zapytanie';
}

function extractTitle(html, fallback = '') {
  return (
    getMeta(html, 'og:title') ||
    clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) ||
    clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) ||
    fallback
  )
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s*-\s*MetaInmo.*$/i, '')
    .trim();
}

function extractDescription(html, title) {
  return (
    getMeta(html, 'og:description') ||
    getMeta(html, 'description') ||
    `${title} — wybrana nowa inwestycja na Costa Blanca.`
  );
}

function extractLocation(html) {
  const text = clean(html);

  const cities = [
    'Alicante',
    'San Juan',
    'Mutxamel',
    'El Campello',
    'Villajoyosa',
    'Vila Joiosa',
    'Finestrat',
    'Benidorm',
    'Calpe',
    'Guardamar',
    'Torrevieja',
    'Orihuela'
  ];

  const city = cities.find(c => text.toLowerCase().includes(c.toLowerCase()));
  return city ? `Alicante, ${city}` : 'Costa Blanca';
}

function extractArea(html) {
  const text = clean(html);
  const m =
    text.match(/(\d+[.,]?\d*)\s*m²/i) ||
    text.match(/(\d+[.,]?\d*)\s*m2/i);

  return m ? `${m[1]} m²` : 'na zapytanie';
}

function extractRooms(html) {
  const text = clean(html);
  const m =
    text.match(/(\d+)\s*(?:sypialni|pokoj|pokoje|bedroom|habitaciones)/i);

  return m ? `${m[1]} pokoje` : 'różne układy';
}

function makeLead(title, meta, price) {
  return {
    pl: [
      `${title} to wybrana nowa inwestycja w lokalizacji ${meta}, przygotowana dla klientów szukających jakości, komfortu i dobrego potencjału wartości na Costa Blanca.`,
      `Projekt łączy nowoczesną architekturę, praktyczne układy i śródziemnomorski styl życia. Cena ${price} sprawia, że oferta może być interesująca zarówno dla klienta prywatnego, jak i inwestora.`,
      `W tej lokalizacji liczą się nie tylko parametry nieruchomości, ale też dostęp do usług, plaż, infrastruktury i przyszła płynność odsprzedaży.`,
      `To propozycja dla osób, które chcą kupić nieruchomość w Hiszpanii do życia, wypoczynku lub jako aktywo inwestycyjne.`
    ],
    en: [
      `${title} is a selected new development in ${meta}, ideal for buyers looking for quality, comfort and long-term value potential on the Costa Blanca.`,
      `The project combines modern architecture, practical layouts and a Mediterranean lifestyle. With price ${price}, it may be attractive both for private buyers and investors.`,
      `In this location, the key factors are not only property specifications, but also access to services, beaches, infrastructure and future resale liquidity.`,
      `A strong option for buyers considering Spain for living, holidays or investment.`
    ],
    es: [
      `${title} es una promoción seleccionada en ${meta}, pensada para compradores que buscan calidad, comodidad y potencial de valor en la Costa Blanca.`,
      `El proyecto combina arquitectura moderna, distribuciones prácticas y estilo de vida mediterráneo. Con precio ${price}, puede ser interesante para uso privado o inversión.`,
      `En esta ubicación importan no solo los parámetros de la vivienda, sino también servicios, playas, infraestructura y liquidez futura.`,
      `Una opción atractiva para vivir, disfrutar de vacaciones o invertir en España.`
    ],
    ru: [
      `${title} — выбранный новый проект в локации ${meta}, подходящий покупателям, которые ищут качество, комфорт и потенциал роста стоимости на Costa Blanca.`,
      `Проект сочетает современную архитектуру, практичные планировки и средиземноморский стиль жизни. Цена ${price} делает его интересным для личного использования и инвестиций.`,
      `В этой локации важны не только параметры объекта, но и доступ к сервисам, пляжам, инфраструктуре и ликвидность при будущей продаже.`,
      `Это вариант для жизни, отдыха или инвестиционной покупки в Испании.`
    ]
  };
}

function toProject(raw) {
  const slug = slugify(raw.title);
  const lead = makeLead(raw.title, raw.meta, raw.price);

  return {
    slug,
    title: raw.title,
    shareTitle: raw.title,
    sharePrice: raw.price === 'na zapytanie' ? raw.price : `od ${raw.price.replace(/^od\s+/i, '')}`,
    shareDescription: `${raw.title} · ${raw.price}`,
    shareImage: raw.image,
    image: raw.image,
    images: raw.images,
    href: `/pl/new-developments/xml-catalog/?slug=${slug}`,
    sourceUrl: raw.url,
    price: raw.price,
    priceValue: priceValue(raw.price),
    filterLocation: slugify(raw.meta).split('-')[0] || 'alicante',
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

async function parseDetail(url) {
  const html = await fetchHtml(url);

  const title = extractTitle(html);
  const price = extractPrice(html);
  const meta = extractLocation(html);
  const images = extractImages(html);
  const description = extractDescription(html, title);

  if (!title || title.length < 3) return null;
  if (!images.length) return null;

  return {
    url,
    title,
    price,
    meta,
    image: images[0],
    images,
    area: extractArea(html),
    rooms: extractRooms(html),
    description
  };
}

async function main() {
  console.log('Fetching list...');
  const listHtml = await fetchHtml(SOURCE_URL);
  const links = extractListLinks(listHtml);

  console.log('Project links found:', links.length);

  const current = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const existingSlugs = new Set(current.map(p => p.slug));
  const imported = [];

  for (const url of links) {
    if (imported.length >= LIMIT) break;

    try {
      console.log('Parsing:', url);
      const raw = await parseDetail(url);
      if (!raw) continue;

      const project = toProject(raw);

      if (existingSlugs.has(project.slug)) continue;

      imported.push(project);
      existingSlugs.add(project.slug);

      await new Promise(r => setTimeout(r, 350));
    } catch (e) {
      console.log('Skip:', url, e.message);
    }
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
