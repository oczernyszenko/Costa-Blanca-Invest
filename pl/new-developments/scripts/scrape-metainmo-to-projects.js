const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://spain.metainmo.com/pl/alicante/promociones';
const SITE = 'https://costa-blanca-invest.com';

const projectsPath = path.join(__dirname, '..', 'projects.json');
const outputPath = path.join(__dirname, '..', 'projects.imported.json');

const LIMIT = 50;

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function priceValue(price = '') {
  const n = String(price).replace(/\s/g, '').match(/\d+/);
  return n ? Number(n[0]) : 0;
}

function abs(url = '') {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return SITE + url;
  return SITE + '/' + url;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function cityPriority(meta = '', title = '') {
  const text = `${meta} ${title}`.toLowerCase();

  if (text.includes('alicante')) return 1;
  if (text.includes('san juan')) return 2;
  if (text.includes('mutxamel')) return 3;
  if (text.includes('campello')) return 4;
  if (text.includes('villajoyosa') || text.includes('vila joiosa')) return 5;
  if (text.includes('finestrat')) return 20;
  if (text.includes('benidorm')) return 21;
  if (text.includes('calpe')) return 22;
  if (text.includes('guardamar')) return 30;
  if (text.includes('torrevieja')) return 40;
  if (text.includes('orihuela')) return 50;

  return 99;
}

function makeCopy(project) {
  const title = project.title;
  const meta = project.meta || 'Costa Blanca';
  const price = project.price || '';
  const type = project.params?.Typ || 'Apartamenty';

  return {
    pl: {
      desc: `${title} to starannie wybrana nowa inwestycja na Costa Blanca — połączenie lokalizacji, komfortu i potencjału inwestycyjnego.`,
      seoDescription: `${title} · ${meta} · ${price}. Nowa inwestycja Costa Blanca Invest z galerią zdjęć, parametrami i szybkim kontaktem.`,
      seoDescription2: `Projekt jest odpowiedni dla klientów szukających nieruchomości do życia, wypoczynku lub inwestycji w Hiszpanii.`,
      lead: [
        `${title} to nowa inwestycja w lokalizacji ${meta}, wybrana pod kątem stylu życia, funkcjonalności i potencjału wartości na Costa Blanca.`,
        `Oferta łączy nowoczesny standard, praktyczne układy oraz atrakcyjne otoczenie, dzięki czemu sprawdzi się zarówno jako second home, jak i zakup inwestycyjny.`,
        `Dla klientów Costa Blanca Invest ważne są nie tylko parametry, ale również bezpieczeństwo wyboru, płynność odsprzedaży i realna użyteczność nieruchomości.`,
        `${type} w tej lokalizacji mogą być interesującą propozycją dla osób, które chcą korzystać z Hiszpanii prywatnie albo analizują wynajem i wzrost wartości.`
      ]
    },
    en: {
      desc: `${title} is a selected new development on the Costa Blanca — combining location, comfort and investment potential.`,
      seoDescription: `${title} · ${meta} · ${price}. New development selected by Costa Blanca Invest with photos, key details and quick contact.`,
      seoDescription2: `The project is suitable for buyers looking for a property for living, holidays or investment in Spain.`,
      lead: [
        `${title} is a new development in ${meta}, selected for lifestyle quality, functional layouts and long-term value potential on the Costa Blanca.`,
        `The offer combines a modern standard, practical layouts and an attractive setting, making it suitable as a second home or investment purchase.`,
        `For Costa Blanca Invest clients, the important factors are not only specifications, but also safety of choice, resale liquidity and real everyday usability.`,
        `${type} in this location may be an attractive option for buyers who want to enjoy Spain privately or analyse rental and capital growth potential.`
      ]
    },
    es: {
      desc: `${title} es una promoción seleccionada en la Costa Blanca — ubicación, confort y potencial de inversión.`,
      seoDescription: `${title} · ${meta} · ${price}. Promoción seleccionada por Costa Blanca Invest con fotos, detalles clave y contacto rápido.`,
      seoDescription2: `El proyecto es adecuado para compradores que buscan vivienda para vivir, vacaciones o inversión en España.`,
      lead: [
        `${title} es una promoción en ${meta}, seleccionada por su estilo de vida, distribución funcional y potencial de valor en la Costa Blanca.`,
        `La oferta combina estándar moderno, distribuciones prácticas y un entorno atractivo, por lo que funciona como segunda residencia o inversión.`,
        `Para los clientes de Costa Blanca Invest importan no solo los parámetros, sino también la seguridad de la elección, la liquidez futura y el uso real de la vivienda.`,
        `${type} en esta ubicación puede ser una propuesta interesante para quienes desean disfrutar de España o analizar alquiler y revalorización.`
      ]
    },
    ru: {
      desc: `${title} — выбранная новая недвижимость на Costa Blanca: локация, комфорт и инвестиционный потенциал.`,
      seoDescription: `${title} · ${meta} · ${price}. Новая недвижимость Costa Blanca Invest с фото, параметрами и быстрым контактом.`,
      seoDescription2: `Проект подходит покупателям, которые ищут объект для жизни, отдыха или инвестиций в Испании.`,
      lead: [
        `${title} — новый проект в локации ${meta}, выбранный с точки зрения качества жизни, планировок и потенциала роста стоимости на Costa Blanca.`,
        `Предложение сочетает современный стандарт, практичные планировки и привлекательное окружение, поэтому подходит как для второго дома, так и для инвестиции.`,
        `Для клиентов Costa Blanca Invest важны не только параметры, но и безопасность выбора, ликвидность при продаже и реальная удобность объекта.`,
        `${type} в этой локации могут быть интересны тем, кто хочет пользоваться Испанией лично или рассматривает аренду и рост стоимости.`
      ]
    }
  };
}

function toProject(raw) {
  const slug = slugify(raw.title);
  const title = raw.title;
  const price = raw.price || '';
  const meta = raw.meta || 'Costa Blanca';
  const image = raw.image || '';

  const params = {
    Lokalizacja: meta,
    Typ: raw.type || 'Apartamenty',
    Powierzchnia: raw.area || 'na zapytanie',
    Pokoje: raw.rooms || 'na zapytanie',
    Cena: price
  };

  const copy = makeCopy({ title, meta, price, params });

  return {
    slug,
    title,
    shareTitle: title,
    sharePrice: price && /^(od|from|desde|от)\s/i.test(price) ? price : `od ${price}`,
    shareDescription: `${title} · ${price && /^(od|from|desde|от)\s/i.test(price) ? price : `od ${price}`}`,
    shareImage: image,
    image,
    images: unique([image, ...(raw.images || [])]),
    href: `/pl/new-developments/xml-catalog/?slug=${slug}`,
    sourceUrl: raw.url,
    price,
    priceValue: priceValue(price),
    filterLocation: slugify(meta).split('-')[0] || 'costa-blanca',
    meta,
    desc: copy.pl.desc,
    chip: raw.chip || 'Nowa inwestycja',
    params,
    seoTitle: `${title} | Costa Blanca Invest`,
    seoDescription: copy.pl.seoDescription,
    seoDescription2: copy.pl.seoDescription2,
    translations: {
      pl: {
        title,
        meta,
        price,
        desc: copy.pl.desc,
        seoDescription: copy.pl.seoDescription,
        seoDescription2: copy.pl.seoDescription2,
        lead: copy.pl.lead
      },
      en: {
        title,
        meta,
        price,
        desc: copy.en.desc,
        seoDescription: copy.en.seoDescription,
        seoDescription2: copy.en.seoDescription2,
        lead: copy.en.lead
      },
      es: {
        title,
        meta,
        price,
        desc: copy.es.desc,
        seoDescription: copy.es.seoDescription,
        seoDescription2: copy.es.seoDescription2,
        lead: copy.es.lead
      },
      ru: {
        title,
        meta,
        price,
        desc: copy.ru.desc,
        seoDescription: copy.ru.seoDescription,
        seoDescription2: copy.ru.seoDescription2,
        lead: copy.ru.lead
      }
    },
    seoContent: {
      pl: copy.pl.lead,
      en: copy.en.lead,
      es: copy.es.lead,
      ru: copy.ru.lead
    },
    lead: copy.pl.lead
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 CostaBlancaInvestBot/1.0'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return await res.text();
}

function extractCards(html) {
  const cards = [];

  const blocks = html.split(/<article|<div class="[^"]*(?:property|card|listing|promotion)[^"]*"/i);

  for (const block of blocks) {
    if (!block || block.includes('xxxxxxxx')) continue;

    const links = [...block.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const imgs = [...block.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => abs(m[1]));

    const text = escText(
      block
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    );

    if (!imgs.length) continue;

    const priceMatch = text.match(/(?:od\s*)?[\d\s]{3,}\s*€/i);
    const price = priceMatch ? escText(priceMatch[0]) : '';

    const titleMatch =
      text.match(/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.'-]{3,60})\s+(?:od\s*)?[\d\s]{3,}\s*€/) ||
      text.match(/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.'-]{3,60})/);

    const title = titleMatch ? escText(titleMatch[1]) : '';

    if (!title || !price) continue;
    if (/cookie|login|menu|facebook|instagram|whatsapp/i.test(title)) continue;

    const urlRaw = links.find(l => /promociones|obra-nueva|new|alicante|\/pl\//i.test(l)) || links[0] || '';
    const url = urlRaw.startsWith('http') ? urlRaw : `https://spain.metainmo.com${urlRaw}`;

    const meta =
      ['Alicante', 'San Juan', 'Mutxamel', 'El Campello', 'Villajoyosa', 'Vila Joiosa', 'Finestrat', 'Benidorm', 'Calpe', 'Guardamar', 'Torrevieja', 'Orihuela']
        .find(city => text.toLowerCase().includes(city.toLowerCase())) || 'Costa Blanca';

    cards.push({
      title,
      price,
      meta,
      image: imgs[0],
      images: imgs.slice(0, 8),
      url,
      rawText: text.slice(0, 500)
    });
  }

  const seen = new Set();

  return cards.filter(card => {
    const key = slugify(card.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const current = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const existing = new Set(current.map(p => p.slug));

  const html = await fetchHtml(SOURCE_URL);
  const cards = extractCards(html)
    .sort((a, b) => cityPriority(a.meta, a.title) - cityPriority(b.meta, b.title));

  const imported = [];

  for (const card of cards) {
    const project = toProject(card);
    if (existing.has(project.slug)) continue;
    imported.push(project);
    if (imported.length >= LIMIT) break;
  }

  const result = [...current, ...imported];

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Current: ${current.length}`);
  console.log(`Imported: ${imported.length}`);
  console.log(`Total: ${result.length}`);
  console.log(`Saved: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
