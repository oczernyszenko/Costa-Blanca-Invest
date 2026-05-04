const fs = require("fs");
const path = require("path");

const SOURCE_URL = "https://spain.metainmo.com/pl/alicante/promociones";
const projectsPath = path.join(__dirname, "..", "projects.json");

function clean(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function absoluteUrl(url = "") {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `https://spain.metainmo.com${url}`;
  return `https://spain.metainmo.com/${url}`;
}

function priceValue(price = "") {
  const match = String(price).replace(/\s/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function detectCity(text = "") {
  const t = clean(text).toLowerCase();
  const map = [
    ["torrevieja", "torrevieja"],
    ["calpe", "calpe"],
    ["kalpe", "calpe"],
    ["benidorm", "benidorm"],
    ["finestrat", "finestrat"],
    ["polop", "polop"],
    ["guardamar", "guardamar"],
    ["villajoyosa", "villajoyosa"],
    ["vila joiosa", "villajoyosa"],
    ["mutxamel", "alicante"],
    ["alicante", "alicante"],
    ["pilar de la horadada", "pilar-de-la-horadada"],
    ["orihuela", "orihuela"]
  ];

  for (const [needle, key] of map) {
    if (t.includes(needle)) return key;
  }

  return "alicante";
}

function prettyLocation(key = "") {
  const map = {
    alicante: "Alicante",
    torrevieja: "Torrevieja",
    calpe: "Calpe",
    benidorm: "Benidorm",
    finestrat: "Finestrat",
    polop: "Polop",
    guardamar: "Guardamar",
    villajoyosa: "Villajoyosa",
    "pilar-de-la-horadada": "Pilar de la Horadada",
    orihuela: "Orihuela"
  };

  return map[key] || "Costa Blanca";
}

function makeLead(title, meta, price) {
  return {
    pl: [
      `${title} to starannie wybrana nowa inwestycja w lokalizacji ${meta}, przygotowana dla klientów szukających jakości, komfortu i dobrego potencjału wartości na Costa Blanca.`,
      `Projekt łączy nowoczesną architekturę, praktyczne układy i śródziemnomorski styl życia. Cena ${price} sprawia, że oferta może być interesująca zarówno dla klienta prywatnego, jak i inwestora.`,
      `W tej lokalizacji liczą się nie tylko parametry nieruchomości, ale także dostęp do usług, plaż, infrastruktury oraz przyszła płynność odsprzedaży.`,
      `${title} może sprawdzić się jako second home w Hiszpanii, baza wakacyjna lub zakup inwestycyjny z potencjałem wynajmu i wzrostu wartości.`
    ],
    en: [
      `${title} is a carefully selected new development in ${meta}, designed for buyers looking for quality, comfort and long-term value potential on the Costa Blanca.`,
      `The project combines modern architecture, practical layouts and a Mediterranean lifestyle. With a price of ${price}, it may be attractive both for private buyers and investors.`,
      `In this location, the key factors are not only the property specifications, but also access to services, beaches, infrastructure and future resale liquidity.`,
      `${title} can work well as a second home in Spain, a holiday base or an investment purchase with rental and value-growth potential.`
    ],
    es: [
      `${title} es una promoción seleccionada en ${meta}, pensada para compradores que buscan calidad, comodidad y potencial de valor en la Costa Blanca.`,
      `El proyecto combina arquitectura moderna, distribuciones prácticas y estilo de vida mediterráneo. Con precio ${price}, puede ser interesante tanto para uso privado como para inversión.`,
      `En esta ubicación importan no solo los parámetros de la vivienda, sino también el acceso a servicios, playas, infraestructura y liquidez futura.`,
      `${title} puede funcionar como segunda residencia en España, base vacacional o compra de inversión con potencial de alquiler y revalorización.`
    ],
    ru: [
      `${title} — тщательно выбранный новый проект в локации ${meta}, подходящий покупателям, которые ищут качество, комфорт и потенциал роста стоимости на Costa Blanca.`,
      `Проект сочетает современную архитектуру, практичные планировки и средиземноморский стиль жизни. Цена ${price} делает предложение интересным как для личного использования, так и для инвестиций.`,
      `В этой локации важны не только параметры объекта, но и доступ к сервисам, пляжам, инфраструктуре и ликвидность при будущей продаже.`,
      `${title} может подойти как второй дом в Испании, база для отдыха или инвестиционная покупка под аренду и рост стоимости.`
    ]
  };
}

function extractImages(block) {
  const images = [];
  const regexes = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<img[^>]+data-src=["']([^"']+)["']/gi,
    /<source[^>]+srcset=["']([^"']+)["']/gi
  ];

  for (const re of regexes) {
    let m;
    while ((m = re.exec(block))) {
      const url = absoluteUrl(m[1].split(",")[0].trim().split(" ")[0]);
      if (!url) continue;
      if (/logo|avatar|placeholder|favicon|svg|base64/i.test(url)) continue;
      if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) continue;
      images.push(url);
    }
  }

  return [...new Set(images)].slice(0, 12);
}

function extractProjectsFromList(html) {
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let m;

  while ((m = anchorRegex.exec(html))) {
    const href = absoluteUrl(m[1]);
    const text = clean(m[2]);

    if (!/nowa inwestycja/i.test(text)) continue;
    if (/xxxxxxxx/i.test(text)) continue;
    if (!href.includes("metainmo.com")) continue;

    anchors.push({ href, text, index: m.index });
  }

  const projects = [];

  for (let i = 0; i < anchors.length; i++) {
    const current = anchors[i];
    const next = anchors[i + 1];
    const block = html.slice(current.index, next ? next.index : html.length);

    const rawTitle =
      current.text.match(/Nowa inwestycja\s+(.+?)\s+promocja\s+w/i)?.[1] ||
      current.text.replace(/^Nowa inwestycja\s+/i, "").replace(/\s+promocja\s+w.*$/i, "");

    const title = clean(rawTitle);
    if (!title || title.length < 3) continue;

    const locationText =
      current.text.match(/promocja\s+w\s+(.+)$/i)?.[1] ||
      clean(block).match(/Alicante,\s*([^*]+?)(?:Rok oddania|Stan|Pozwolenie|m2|Nieruchomość|$)/i)?.[1] ||
      "";

    const cityKey = detectCity(`${title} ${locationText} ${block}`);
    const locationLabel = prettyLocation(cityKey);

    const text = clean(block);

    const priceMatch =
      text.match(/(?:od\s*)?[\d\s]{3,}\s*€/i) ||
      text.match(/[\d\s]{3,}\s*EUR/i);

    const price = priceMatch ? clean(priceMatch[0]).replace(/\s+€/g, " €") : "Cena na zapytanie";

    const areaMatch =
      text.match(/m2 zabudowane:\s*([\d.,]+\s*m²)/i) ||
      text.match(/(\d+[.,]?\d*)\s*m²/i);

    const roomsMatch =
      text.match(/(\d+)-pokojowe/i) ||
      text.match(/(\d+)\s*(?:sypialni|sypialnie|pokoj|pokoje|bedroom|habitaciones)/i);

    const area = areaMatch ? clean(areaMatch[1] || `${areaMatch[0]}`) : "na zapytanie";
    const rooms = roomsMatch ? `${roomsMatch[1]} pokoje` : "różne układy";
    const images = extractImages(block);
    const slug = slugify(title);

    if (!slug || !images.length) continue;

    projects.push({
      slug,
      title,
      sourceUrl: current.href,
      image: images[0],
      images,
      price,
      priceValue: priceValue(price),
      filterLocation: cityKey,
      meta: `${locationLabel} · Costa Blanca`,
      area,
      rooms
    });
  }

  return projects;
}

function toProject(raw) {
  const lead = makeLead(raw.title, raw.meta, raw.price);
  const sharePrice = raw.price === "Cena na zapytanie"
    ? raw.price
    : `od ${raw.price.replace(/^od\s+/i, "")}`;

  return {
    slug: raw.slug,
    title: raw.title,
    image: raw.image,
    images: raw.images,
    href: `/pl/new-developments/xml-catalog/?slug=${raw.slug}`,
    sourceUrl: raw.sourceUrl,
    price: raw.price,
    priceValue: raw.priceValue,
    filterLocation: raw.filterLocation,
    meta: raw.meta,
    desc: `${raw.title} — nowa inwestycja na Costa Blanca z potencjałem do życia, wypoczynku i inwestycji.`,
    chip: "Nowa inwestycja · Costa Blanca",
    params: {
      Lokalizacja: prettyLocation(raw.filterLocation),
      Typ: "Apartamenty / Wille",
      Powierzchnia: raw.area,
      Pokoje: raw.rooms,
      Cena: raw.price
    },
    seoTitle: `${raw.title} | Costa Blanca Invest`,
    seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Nowa inwestycja Costa Blanca Invest z galerią, parametrami i szybkim kontaktem.`,
    seoDescription2: lead.pl[1],
    translations: {
      pl: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — nowa inwestycja na Costa Blanca z potencjałem do życia, wypoczynku i inwestycji.`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}.`,
        seoDescription2: lead.pl[1],
        lead: lead.pl
      },
      en: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — selected new development on the Costa Blanca.`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}.`,
        seoDescription2: lead.en[1],
        lead: lead.en
      },
      es: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — promoción seleccionada en la Costa Blanca.`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}.`,
        seoDescription2: lead.es[1],
        lead: lead.es
      },
      ru: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — выбранный новый проект на Costa Blanca.`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}.`,
        seoDescription2: lead.ru[1],
        lead: lead.ru
      }
    },
    shareTitle: raw.title,
    sharePrice,
    shareDescription: `${raw.title} · ${sharePrice}`,
    shareImage: raw.image,
    seoContent: lead,
    lead: lead.pl
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Costa Blanca Invest Importer"
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.text();
}

async function main() {
  console.log("Fetching Metainmo list...");
  const html = await fetchHtml(SOURCE_URL);

  const current = fs.existsSync(projectsPath)
    ? JSON.parse(fs.readFileSync(projectsPath, "utf8"))
    : [];

  const existingSlugs = new Set(current.map(p => p.slug));
  const rawProjects = extractProjectsFromList(html);

  console.log("Found public projects:", rawProjects.length);

  const imported = [];

  for (const raw of rawProjects) {
    if (existingSlugs.has(raw.slug)) continue;

    const project = toProject(raw);
    imported.push(project);
    existingSlugs.add(project.slug);
  }

  const updated = [...current, ...imported];

  fs.writeFileSync(projectsPath, JSON.stringify(updated, null, 2), "utf8");

  console.log("Added:", imported.length);
  console.log("Total:", updated.length);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
}); 
