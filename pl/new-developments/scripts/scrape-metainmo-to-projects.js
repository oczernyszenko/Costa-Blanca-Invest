const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://spain.metainmo.com/pl/alicante/promociones";
const REPO_ROOT = process.cwd();
const projectsPath = path.join(REPO_ROOT, "pl", "new-developments", "projects.json");

const IMPORT_LIMIT = Number(process.env.IMPORT_LIMIT || process.env.limit || 50);
const MAX_PAGES = Number(process.env.MAX_PAGES || 80);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 12);
const DELAY_MS = Number(process.env.DELAY_MS || 450);
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS || 220);
const UPDATE_EXISTING = process.env.UPDATE_EXISTING !== "0";
const SITE_URL = "https://costa-blanca-invest.com";
const META_URL = "https://spain.metainmo.com";

const FALLBACK_IMAGE = `${SITE_URL}/pl/new-developments/images/new-developments-costa-blanca.jpg`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(value = "") {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&euro;/gi, "€")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function absoluteUrl(url = "", base = META_URL) {
  const raw = String(url || "").trim();
  if (!raw || raw.startsWith("data:")) return "";
  try {
    return new URL(raw, base).href;
  } catch {
    return "";
  }
}

function hashCode(value = "") {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function priceValue(price = "") {
  const match = String(price || "").replace(/\s/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function extractPriceFromText(text = "") {
  const t = clean(text);
  const match =
    t.match(/(?:od\s*)?[\d\s]{3,}\s*€/i) ||
    t.match(/€\s*[\d\s]{3,}/i) ||
    t.match(/[\d\s]{3,}\s*EUR/i);

  if (!match) return "Cena na zapytanie";

  return clean(match[0])
    .replace(/EUR/i, "€")
    .replace(/\s+€/g, " €");
}

function extractAreaFromText(text = "") {
  const t = clean(text);
  const match =
    t.match(/m2 zabudowane:\s*([\d.,]+\s*m²)/i) ||
    t.match(/powierzchnia:\s*([\d.,]+\s*m²)/i) ||
    t.match(/(\d+[.,]?\d*)\s*m²/i) ||
    t.match(/(\d+[.,]?\d*)\s*m2/i);

  return match ? clean(match[1] || match[0]).replace(/m2/i, "m²") : "na zapytanie";
}

function extractRoomsFromText(text = "") {
  const t = clean(text);
  const match =
    t.match(/(\d+)\s*-\s*pokojowe/i) ||
    t.match(/(\d+)\s*(?:sypialni|sypialnie|pokoj|pokoje|bedroom|bedrooms|habitaciones|dormitorios)/i);

  return match ? `${match[1]} pokoje` : "różne układy";
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
    ["san juan", "alicante"],
    ["el campello", "alicante"],
    ["alicante", "alicante"],
    ["pilar de la horadada", "pilar-de-la-horadada"],
    ["torre de la horadada", "pilar-de-la-horadada"],
    ["orihuela", "orihuela"],
    ["punta prima", "orihuela"],
    ["playa flamenca", "orihuela"],
    ["la zenia", "orihuela"],
    ["campoamor", "orihuela"],
    ["mil palmeras", "pilar-de-la-horadada"],
    ["ciudad quesada", "rojales"],
    ["rojales", "rojales"],
    ["denia", "denia"],
    ["dénia", "denia"],
    ["javea", "javea"],
    ["jávea", "javea"],
    ["xàbia", "javea"],
    ["altea", "altea"],
    ["moraira", "moraira"],
    ["benissa", "benissa"],
    ["benitachell", "benitachell"]
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
    orihuela: "Orihuela Costa",
    rojales: "Rojales",
    denia: "Dénia",
    javea: "Jávea / Xàbia",
    altea: "Altea",
    moraira: "Moraira",
    benissa: "Benissa",
    benitachell: "Benitachell"
  };

  return map[key] || "Costa Blanca";
}

function isGoodImage(url = "") {
  const u = String(url || "").trim();
  if (!u) return false;
  if (/logo|avatar|placeholder|favicon|sprite|icon|svg|base64|blank|loading/i.test(u)) return false;
  return /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(u);
}

function addImage(images, url) {
  const normalized = absoluteUrl(url);
  if (!isGoodImage(normalized)) return;
  if (!images.includes(normalized)) images.push(normalized);
}

function extractSrcset(srcset = "") {
  return String(srcset || "")
    .split(",")
    .map(item => item.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractImages(html = "") {
  const images = [];
  const source = String(html || "");
  let m;

  const attrRegex = /(?:src|data-src|data-lazy-src|data-original|data-full|data-image|href)=["']([^"']+)["']/gi;
  while ((m = attrRegex.exec(source))) addImage(images, m[1]);

  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(source))) {
    extractSrcset(m[1]).forEach(url => addImage(images, url));
  }

  const jsonImageRegex = /["'](?:image|url|src|large|original|full|preview)["']\s*:\s*["']([^"']+)["']/gi;
  while ((m = jsonImageRegex.exec(source))) addImage(images, m[1].replace(/\\\//g, "/"));

  const directImageRegex = /https?:\\?\/\\?\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  while ((m = directImageRegex.exec(source))) addImage(images, m[0].replace(/\\\//g, "/"));

  return images.slice(0, MAX_IMAGES);
}

function extractTitleFromDetail(html = "") {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  return clean(h1 || ogTitle || title || "")
    .replace(/\s*\|\s*.*$/g, "")
    .replace(/\s*-\s*MetaInmo.*$/i, "");
}

function getNextPageUrl(html = "", currentUrl = BASE_URL) {
  const source = String(html || "");

  const relNext = source.match(/<a[^>]+rel=["'][^"']*next[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (relNext) return absoluteUrl(relNext[1], currentUrl);

  const reverseRelNext = source.match(/<a[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*next[^"']*["']/i);
  if (reverseRelNext) return absoluteUrl(reverseRelNext[1], currentUrl);

  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = anchorRegex.exec(source))) {
    const href = absoluteUrl(m[1], currentUrl);
    const text = clean(m[2]).toLowerCase();
    const tag = m[0].toLowerCase();

    if (
      text === "next" ||
      text === "następna" ||
      text === "nastepna" ||
      text === "siguiente" ||
      text === ">" ||
      text === "›" ||
      tag.includes("next") ||
      tag.includes("pagination-next")
    ) {
      return href;
    }
  }

  return null;
}

function getFallbackPageUrl(page) {
  const url = new URL(BASE_URL);
  url.searchParams.set("page", String(page));
  return url.href;
}

function collectProjectLinks(html = "") {
  const anchors = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = anchorRegex.exec(html))) {
    const href = absoluteUrl(m[1]);
    const inner = m[2] || "";
    const text = clean(inner);
    const tag = m[0] || "";

    if (!href.includes("metainmo.com")) continue;

    const locked =
      /subskrypcj/i.test(text) ||
      /zobaczyć tę nieruchomość/i.test(text) ||
      /zobaczyc te nieruchomosc/i.test(text) ||
      /xxxxxxxx/i.test(text);

    const looksLikeProject =
      /nowa inwestycja/i.test(text) ||
      /promocja\s+w/i.test(text) ||
      /\/promocion\//i.test(href) ||
      /\/obra-nueva\//i.test(href) ||
      /\/new-development\//i.test(href) ||
      /card|property|promotion|promocion|inmueble/i.test(tag);

    if (!looksLikeProject && !locked) continue;

    anchors.push({ href, inner, text, index: m.index, locked });
  }

  return anchors;
}

function titleFromLockedBlock(blockText = "", fallback = "") {
  const text = clean(blockText);
  const city = clean(
    text.split("Alicante,")[1]?.split(",")[0]?.split("Rok oddania")[0]?.split("Stan")[0] ||
    text.match(/promocja\s+w\s+(.+?)(?:\s|$)/i)?.[1] ||
    "Costa Blanca"
  );

  const num = String(hashCode(`${city}|${fallback}|${text}`)).slice(0, 5);
  return `Nowa inwestycja ${city} ${num}`;
}

async function fetchHtml(url, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 Costa-Blanca-Invest-Importer",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "accept-language": "pl-PL,pl;q=0.9,es;q=0.8,en;q=0.7,ru;q=0.6"
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(700 * (attempt + 1));
    }
  }

  throw lastError;
}

async function fetchDetailData(url) {
  try {
    await sleep(DETAIL_DELAY_MS);
    const html = await fetchHtml(url, 1);
    const text = clean(html);

    return {
      html,
      text,
      title: extractTitleFromDetail(html),
      images: extractImages(html),
      price: extractPriceFromText(text),
      area: extractAreaFromText(text),
      rooms: extractRoomsFromText(text)
    };
  } catch (error) {
    console.warn(`Detail failed: ${url} — ${error.message}`);

    return {
      html: "",
      text: "",
      title: "",
      images: [],
      price: "Cena na zapytanie",
      area: "na zapytanie",
      rooms: "różne układy"
    };
  }
}

async function extractProjectsFromList(html) {
  const anchors = collectProjectLinks(html);
  const projects = [];

  for (let i = 0; i < anchors.length; i++) {
    if (projects.length >= IMPORT_LIMIT) break;

    const current = anchors[i];
    const next = anchors[i + 1];
    const block = html.slice(current.index, next ? next.index : Math.min(html.length, current.index + 9000));
    const blockText = clean(block);

    let rawTitle =
      current.text.match(/Nowa inwestycja\s+(.+?)\s+promocja\s+w/i)?.[1] ||
      current.text.match(/^(.+?)\s+promocja\s+w/i)?.[1] ||
      current.text.replace(/^Nowa inwestycja\s+/i, "").replace(/\s+promocja\s+w.*$/i, "");

    let title = clean(rawTitle);
    let price = extractPriceFromText(blockText);
    let area = extractAreaFromText(blockText);
    let rooms = extractRoomsFromText(blockText);
    let images = extractImages(block);
    let detail = null;

    if (current.locked || /xxxxxxxx|subskrypcj/i.test(title)) {
      title = titleFromLockedBlock(blockText, String(i));
    } else {
      detail = await fetchDetailData(current.href);

      if (detail.title) title = detail.title;
      if (detail.price !== "Cena na zapytanie") price = detail.price;
      if (detail.area !== "na zapytanie") area = detail.area;
      if (detail.rooms !== "różne układy") rooms = detail.rooms;

      images = [...new Set([...images, ...detail.images])].slice(0, MAX_IMAGES);
    }

    if (!title || title.length < 3 || title.toLowerCase().includes("xxxxxxxx")) {
      title = `Nowa inwestycja Costa Blanca ${String(hashCode(blockText + i)).slice(0, 5)}`;
    }

    const locationText =
      current.text.match(/promocja\s+w\s+(.+)$/i)?.[1] ||
      blockText.match(/Alicante,\s*([^*]+?)(?:Rok oddania|Stan|Pozwolenie|m2|Nieruchomość|$)/i)?.[1] ||
      detail?.text ||
      blockText;

    const cityKey = detectCity(`${title} ${locationText} ${blockText} ${detail?.text || ""}`);
    const locationLabel = prettyLocation(cityKey);
    const projectSlug = slugify(title) || `project-${String(hashCode(blockText + i)).slice(0, 8)}`;

    projects.push({
      slug: projectSlug,
      title,
      sourceUrl: current.href,
      image: images[0] || FALLBACK_IMAGE,
      images: images.length ? images : [FALLBACK_IMAGE],
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

function makeLead(title, meta, price) {
  return {
    pl: [
      `${title} to wybrana nowa inwestycja w lokalizacji ${meta}, przygotowana dla klientów szukających jakości, komfortu i potencjału wartości na Costa Blanca.`,
      `Projekt łączy nowoczesną architekturę, praktyczne układy i śródziemnomorski styl życia. Cena ${price} sprawia, że oferta może być interesująca dla klienta prywatnego i inwestora.`,
      `Lokalizacja zapewnia dostęp do usług, plaż, infrastruktury oraz potencjalną płynność przy przyszłej odsprzedaży.`,
      `${title} może sprawdzić się jako second home w Hiszpanii, baza wakacyjna lub zakup inwestycyjny.`
    ],
    es: [
      `${title} es una promoción seleccionada en ${meta}, pensada para compradores que buscan calidad, comodidad y potencial de valor en la Costa Blanca.`,
      `El proyecto combina arquitectura moderna, distribuciones prácticas y estilo de vida mediterráneo. Con precio ${price}, puede ser interesante para uso privado e inversión.`,
      `La ubicación ofrece acceso a servicios, playas, infraestructura y potencial liquidez en una futura reventa.`,
      `${title} puede funcionar como segunda residencia, base vacacional o compra de inversión.`
    ],
    en: [
      `${title} is a selected new development in ${meta}, designed for buyers looking for quality, comfort and long-term value potential on the Costa Blanca.`,
      `The project combines modern architecture, practical layouts and a Mediterranean lifestyle. With a price of ${price}, it may be attractive for private buyers and investors.`,
      `The location offers access to services, beaches, infrastructure and potential future resale liquidity.`,
      `${title} can work well as a second home in Spain, a holiday base or an investment purchase.`
    ],
    ru: [
      `${title} — выбранный новый проект в локации ${meta}, подходящий покупателям, которые ищут качество, комфорт и потенциал роста стоимости на Costa Blanca.`,
      `Проект сочетает современную архитектуру, практичные планировки и средиземноморский стиль жизни. Цена ${price} делает предложение интересным для личного использования и инвестиций.`,
      `Локация даёт доступ к сервисам, пляжам, инфраструктуре и потенциальной ликвидности при будущей продаже.`,
      `${title} может подойти как второй дом в Испании, база для отдыха или инвестиционная покупка.`
    ]
  };
}

function chipByProject(raw) {
  const text = `${raw.title} ${raw.meta}`.toLowerCase();

  if (text.includes("villa") || text.includes("villas") || text.includes("wille")) return "Villas · Costa Blanca";
  if (text.includes("calpe")) return "Calpe · Sea View";
  if (text.includes("torrevieja")) return "Torrevieja · Investment";
  if (text.includes("benidorm") || text.includes("finestrat")) return "Premium · Alicante";
  if (text.includes("polop")) return "Villas · Polop";

  return "Nowa inwestycja · Costa Blanca";
}

function seoKeywords(raw) {
  const city = prettyLocation(raw.filterLocation);

  return [
    "nowe inwestycje Costa Blanca",
    `nieruchomości ${city}`,
    `apartamenty ${city}`,
    `wille ${city}`,
    "Costa Blanca Invest",
    "nieruchomości Hiszpania",
    "inwestycje Alicante"
  ];
}

function toProject(raw) {
  const lead = makeLead(raw.title, raw.meta, raw.price);
  const city = prettyLocation(raw.filterLocation);
  const sharePrice = raw.price === "Cena na zapytanie"
    ? raw.price
    : `od ${raw.price.replace(/^od\s+/i, "")}`;

  return {
    slug: raw.slug,
    title: raw.title,
    image: raw.image,
    images: raw.images || [raw.image],
    href: `/pl/new-developments/xml-catalog/?slug=${raw.slug}`,
    sourceUrl: raw.sourceUrl,

    price: raw.price,
    priceValue: raw.priceValue,
    filterLocation: raw.filterLocation,
    meta: raw.meta,

    desc: `${raw.title} — nowa inwestycja w lokalizacji ${raw.meta}. Projekt z potencjałem do życia, wypoczynku i inwestycji.`,
    chip: chipByProject(raw),

    params: {
      Lokalizacja: city,
      Typ: "Apartamenty / Wille",
      Powierzchnia: raw.area,
      Pokoje: raw.rooms,
      Cena: raw.price
    },

    seo: {
      title: `${raw.title} | Nowa inwestycja ${city} | Costa Blanca Invest`,
      description: `${raw.title} · ${raw.meta} · ${raw.price}. Nowa inwestycja na Costa Blanca z galerią, parametrami i szybkim kontaktem.`,
      keywords: seoKeywords(raw),
      canonical: `${SITE_URL}/pl/new-developments/xml-catalog/?slug=${raw.slug}`,
      image: raw.image
    },

    seoTitle: `${raw.title} | Costa Blanca Invest`,
    seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Nowa inwestycja Costa Blanca Invest z galerią, parametrami i szybkim kontaktem.`,
    seoDescription2: lead.pl[1],

    translations: {
      pl: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — nowa inwestycja w lokalizacji ${raw.meta}.`,
        chip: chipByProject(raw),
        seoTitle: `${raw.title} | Nowa inwestycja ${city}`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Nowa inwestycja na Costa Blanca.`,
        seoDescription2: lead.pl[1],
        lead: lead.pl
      },
      es: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — promoción seleccionada en ${raw.meta}.`,
        chip: "Obra nueva · Costa Blanca",
        seoTitle: `${raw.title} | Obra nueva ${city}`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Promoción de obra nueva en la Costa Blanca.`,
        seoDescription2: lead.es[1],
        lead: lead.es
      },
      en: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — selected new development in ${raw.meta}.`,
        chip: "New development · Costa Blanca",
        seoTitle: `${raw.title} | New development ${city}`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. New development on the Costa Blanca.`,
        seoDescription2: lead.en[1],
        lead: lead.en
      },
      ru: {
        title: raw.title,
        meta: raw.meta,
        price: raw.price,
        desc: `${raw.title} — новый проект в локации ${raw.meta}.`,
        chip: "Новостройка · Costa Blanca",
        seoTitle: `${raw.title} | Новостройка ${city}`,
        seoDescription: `${raw.title} · ${raw.meta} · ${raw.price}. Новый проект на Costa Blanca.`,
        seoDescription2: lead.ru[1],
        lead: lead.ru
      }
    },

    shareTitle: raw.title,
    sharePrice,
    shareDescription: `${raw.title} · ${sharePrice} · ${raw.meta}`,
    shareImage: raw.image,

    seoContent: lead,
    lead: lead.pl
  };
}

function dedupeRawProjects(rawProjects) {
  const bySlug = new Map();

  for (const raw of rawProjects) {
    if (!raw.slug) continue;

    const existing = bySlug.get(raw.slug);
    if (!existing || (raw.images || []).length > (existing.images || []).length) {
      bySlug.set(raw.slug, raw);
    }
  }

  return [...bySlug.values()];
}

function normalizeExisting(project) {
  if (!project || !project.slug) return project;

  const img = project.image || project.shareImage || FALLBACK_IMAGE;

  return {
    ...project,
    image: img.startsWith("/") ? `${SITE_URL}${img}` : img,
    images: Array.isArray(project.images)
      ? project.images.map(item => item.startsWith("/") ? `${SITE_URL}${item}` : item)
      : [img],
    seo: project.seo || {
      title: project.seoTitle || `${project.title} | Costa Blanca Invest`,
      description: project.seoDescription || `${project.title} · ${project.meta || "Costa Blanca"}`,
      keywords: ["nowe inwestycje Costa Blanca", "Costa Blanca Invest"],
      canonical: `${SITE_URL}/pl/new-developments/xml-catalog/?slug=${project.slug}`,
      image: img.startsWith("/") ? `${SITE_URL}${img}` : img
    }
  };
}

function mergeProjects(current, imported) {
  const bySlug = new Map();
  const bySource = new Map();

  current.map(normalizeExisting).forEach(project => {
    if (!project || !project.slug) return;
    bySlug.set(project.slug, project);
    if (project.sourceUrl) bySource.set(project.sourceUrl, project.slug);
  });

  let added = 0;
  let updated = 0;

  for (const project of imported) {
    const existingSlug = project.sourceUrl && bySource.has(project.sourceUrl)
      ? bySource.get(project.sourceUrl)
      : project.slug;

    if (existingSlug && bySlug.has(existingSlug)) {
      if (!UPDATE_EXISTING) continue;

      const oldProject = bySlug.get(existingSlug);
      bySlug.set(existingSlug, {
        ...oldProject,
        ...project,
        slug: oldProject.slug || project.slug,
        href: oldProject.href || project.href,
        images: project.images?.length ? project.images : oldProject.images,
        image: project.image || oldProject.image,
        sourceUrl: oldProject.sourceUrl || project.sourceUrl
      });

      updated++;
    } else {
      bySlug.set(project.slug, project);
      if (project.sourceUrl) bySource.set(project.sourceUrl, project.slug);
      added++;
    }
  }

  return {
    projects: [...bySlug.values()].slice(0, IMPORT_LIMIT),
    added,
    updated
  };
}

async function main() {
  console.log("Repo root:", REPO_ROOT);
  console.log("Saving to:", projectsPath);
  console.log("Import limit:", IMPORT_LIMIT);

  fs.mkdirSync(path.dirname(projectsPath), { recursive: true });

  const current = fs.existsSync(projectsPath)
    ? JSON.parse(fs.readFileSync(projectsPath, "utf8"))
    : [];

  const allRaw = [];
  const seenUrls = new Set();
  const seenSignatures = new Set();

  let url = BASE_URL;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (allRaw.length >= IMPORT_LIMIT) break;

    if (!url || seenUrls.has(url)) {
      console.log("Repeated or empty page URL. Stop.");
      break;
    }

    seenUrls.add(url);
    console.log(`Fetching page ${page}: ${url}`);

    const html = await fetchHtml(url);
    const pageRaw = dedupeRawProjects(await extractProjectsFromList(html));

    console.log(`Page ${page}: ${pageRaw.length} projects`);

    if (!pageRaw.length) break;

    const signature = pageRaw.map(project => `${project.slug}:${project.sourceUrl}`).join("|");
    if (seenSignatures.has(signature)) {
      console.log("Repeated page content. Stop.");
      break;
    }

    seenSignatures.add(signature);
    allRaw.push(...pageRaw);

    const nextUrl = getNextPageUrl(html, url);
    url = nextUrl && !seenUrls.has(nextUrl) ? nextUrl : getFallbackPageUrl(page + 1);

    await sleep(DELAY_MS);
  }

  const uniqueRaw = dedupeRawProjects(allRaw).slice(0, IMPORT_LIMIT);
  const imported = uniqueRaw.map(toProject).filter(project => project.slug && project.title);
  const result = mergeProjects(current, imported);

  fs.writeFileSync(projectsPath, JSON.stringify(result.projects, null, 2), "utf8");

  console.log("Imported raw:", uniqueRaw.length);
  console.log("Added:", result.added);
  console.log("Updated:", result.updated);
  console.log("Total:", result.projects.length);
  console.log("Done:", projectsPath);

  if (!fs.existsSync(projectsPath)) {
    throw new Error("projects.json was not created");
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
