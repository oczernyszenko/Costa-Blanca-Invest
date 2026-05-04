const fs = require("fs");
const path = require("path");

const BASE_URL = "https://spain.metainmo.com/pl/alicante/promociones";
const projectsPath = path.join(__dirname, "..", "projects.json");

const MAX_PAGES = Number(process.env.MAX_PAGES || 80);
const DELAY_MS = Number(process.env.DELAY_MS || 450);
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS || 180);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 60);
const UPDATE_EXISTING = process.env.UPDATE_EXISTING === "1";
const BACKUP = process.env.BACKUP !== "0";

const SITE_ORIGIN = "https://spain.metainmo.com";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&euro;/g, "€")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return clean(value);
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

function absoluteUrl(url = "", base = SITE_ORIGIN) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return "";
  try {
    return new URL(raw, base).href;
  } catch {
    return "";
  }
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
    ["san juan", "alicante"],
    ["el campello", "alicante"],
    ["alicante", "alicante"],
    ["pilar de la horadada", "pilar-de-la-horadada"],
    ["torre de la horadada", "pilar-de-la-horadada"],
    ["orihuela", "orihuela"],
    ["ciudad quesada", "rojales"],
    ["rojales", "rojales"],
    ["denia", "denia"],
    ["jávea", "javea"],
    ["javea", "javea"],
    ["xàbia", "javea"],
    ["altea", "altea"],
    ["moraira", "moraira"],
    ["benissa", "benissa"],
    ["benitachell", "benitachell"],
    ["punta prima", "orihuela"],
    ["playa flamenca", "orihuela"],
    ["la zenia", "orihuela"],
    ["campoamor", "orihuela"],
    ["mil palmeras", "pilar-de-la-horadada"]
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

function isGoodImage(url = "") {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) return false;
  if (/logo|avatar|placeholder|favicon|sprite|icon|svg|base64|blank|loading/i.test(cleanUrl)) return false;
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(cleanUrl)) return false;
  return true;
}

function addImage(images, url) {
  const normalized = absoluteUrl(url);
  if (!isGoodImage(normalized)) return;
  const noSizeDuplicate = normalized.replace(/[-_](\d{2,5})x(\d{2,5})(?=\.(jpg|jpeg|png|webp))/i, "");
  if (images.some(item => item === normalized || item.replace(/[-_](\d{2,5})x(\d{2,5})(?=\.(jpg|jpeg|png|webp))/i, "") === noSizeDuplicate)) return;
  images.push(normalized);
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

  const attrRegex = /(?:src|data-src|data-lazy-src|data-original|data-full|data-image|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = attrRegex.exec(source))) addImage(images, m[1]);

  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(source))) {
    extractSrcset(m[1]).forEach(url => addImage(images, url));
  }

  const jsonImageRegex = /["'](?:image|url|src|large|original|full)["']\s*:\s*["']([^"']+)["']/gi;
  while ((m = jsonImageRegex.exec(source))) addImage(images, m[1].replace(/\\\//g, "/"));

  const directImageRegex = /https?:\\?\/\\?\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  while ((m = directImageRegex.exec(source))) addImage(images, m[0].replace(/\\\//g, "/"));

  return images.slice(0, MAX_IMAGES);
}

function extractTitleFromDetail(html = "") {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return clean(h1 || ogTitle || title || "").replace(/\s*\|\s*.*$/g, "");
}

function extractPriceFromText(text = "") {
  const t = clean(text);
  const matches = [
    t.match(/(?:od\s*)?[\d\s]{3,}\s*€/i),
    t.match(/[\d\s]{3,}\s*EUR/i),
    t.match(/€\s*[\d\s]{3,}/i)
  ];
  const found = matches.find(Boolean);
  return found ? clean(found[0]).replace(/\s+€/g, " €").replace(/EUR/i, "€") : "Cena na zapytanie";
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

function getNextPageUrl(html = "", currentUrl = BASE_URL) {
  const source = String(html || "");

  const relNext = source.match(/<a[^>]+rel=["'][^"']*next[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (relNext) return absoluteUrl(relNext[1], currentUrl);

  const reverseRelNext = source.match(/<a[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*next[^"']*["']/i);
  if (reverseRelNext) return absoluteUrl(reverseRelNext[1], currentUrl);

  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const candidates = [];

  while ((m = anchorRegex.exec(source))) {
    const href = absoluteUrl(m[1], currentUrl);
    const text = clean(m[2]).toLowerCase();
    const tag = m[0].toLowerCase();
    if (!href) continue;

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
      candidates.push(href);
    }
  }

  return candidates.find(url => url !== currentUrl) || null;
}

function getFallbackPageUrl(currentUrl = BASE_URL, page) {
  const url = new URL(currentUrl || BASE_URL);
  url.searchParams.set("page", String(page));
  return url.href;
}

function collectProjectLinks(html = "") {
  const anchorRegex = /<a[^>]+href=["']([^"']+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let m;

  while ((m = anchorRegex.exec(html))) {
    const href = absoluteUrl(m[1]);
    const inner = m[2] || "";
    const text = clean(inner);
    const tag = m[0] || "";

    if (!href.includes("metainmo.com")) continue;
    if (/xxxxxxxx/i.test(text)) continue;

    const looksLikeProject =
      /nowa inwestycja/i.test(text) ||
      /promocja\s+w/i.test(text) ||
      /\/promocion\//i.test(href) ||
      /\/obra-nueva\//i.test(href) ||
      /\/new-development\//i.test(href) ||
      /card|property|promotion|promocion|inmueble/i.test(tag);

    if (!looksLikeProject) continue;

    anchors.push({ href, inner, text, index: m.index });
  }

  const map = new Map();
  for (const anchor of anchors) {
    if (!map.has(anchor.href)) map.set(anchor.href, anchor);
  }
  return [...map.values()];
}

async function fetchHtml(url, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36 Costa-Blanca-Invest-Importer",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "pl-PL,pl;q=0.9,es;q=0.8,en;q=0.7,ru;q=0.6"
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return await res.text();
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

    // PRO: always open the detail page to collect the maximum gallery, not only the first card image.
    let detail = await fetchDetailData(current.href);
    if (!title && detail.title) title = detail.title;
    if (detail.price !== "Cena na zapytanie") price = detail.price;
    if (detail.area !== "na zapytanie") area = detail.area;
    if (detail.rooms !== "różne układy") rooms = detail.rooms;
    images = [...new Set([...images, ...detail.images])].slice(0, MAX_IMAGES);

    if (!title || title.length < 3) {
      title = slugify(current.href.split("/").filter(Boolean).pop() || "metainmo");
    }

    const locationText =
      current.text.match(/promocja\s+w\s+(.+)$/i)?.[1] ||
      blockText.match(/Alicante,\s*([^*]+?)(?:Rok oddania|Stan|Pozwolenie|m2|Nieruchomość|$)/i)?.[1] ||
      (detail ? detail.text : "") ||
      "";

    const cityKey = detectCity(`${title} ${locationText} ${blockText} ${detail ? detail.text : ""}`);
    const locationLabel = prettyLocation(cityKey);
    const slug = slugify(title) || slugify(current.href.split("/").filter(Boolean).pop() || "");

    if (!slug) continue;

    if (!images.length) {
      console.warn(`No images for: ${title}`);
    }

    projects.push({
      slug,
      title,
      sourceUrl: current.href,
      image: images[0] || "",
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
    image: raw.image || (raw.images && raw.images[0]) || "",
    images: raw.images || [],
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
    shareImage: raw.image || (raw.images && raw.images[0]) || "",
    seoContent: lead,
    lead: lead.pl
  };
}

function dedupeRawProjects(rawProjects) {
  const map = new Map();

  for (const raw of rawProjects) {
    const key = raw.sourceUrl || raw.slug;
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, raw);
      continue;
    }

    const existing = map.get(key);
    const currentImages = raw.images || [];
    const existingImages = existing.images || [];

    if (currentImages.length > existingImages.length) {
      map.set(key, raw);
    }
  }

  const bySlug = new Map();
  for (const raw of map.values()) {
    if (!raw.slug) continue;
    if (!bySlug.has(raw.slug)) bySlug.set(raw.slug, raw);
    else {
      const existing = bySlug.get(raw.slug);
      if ((raw.images || []).length > (existing.images || []).length) bySlug.set(raw.slug, raw);
    }
  }

  return [...bySlug.values()];
}

function mergeProjects(current, imported) {
  const bySlug = new Map();
  const bySource = new Map();

  current.forEach(project => {
    if (project.slug) bySlug.set(project.slug, project);
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
        images: project.images && project.images.length ? project.images : oldProject.images,
        image: project.image || oldProject.image,
        sourceUrl: oldProject.sourceUrl || project.sourceUrl
      });
      updated++;
      continue;
    }

    bySlug.set(project.slug, project);
    if (project.sourceUrl) bySource.set(project.sourceUrl, project.slug);
    added++;
  }

  return {
    projects: [...bySlug.values()],
    added,
    updated
  };
}

async function main() {
  const current = fs.existsSync(projectsPath)
    ? JSON.parse(fs.readFileSync(projectsPath, "utf8"))
    : [];

  if (BACKUP && fs.existsSync(projectsPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = projectsPath.replace(/\.json$/i, `.backup-${stamp}.json`);
    fs.copyFileSync(projectsPath, backupPath);
    console.log("Backup:", backupPath);
  }

  const allRaw = [];
  const seenPageSignatures = new Set();
  const seenUrls = new Set();
  let url = BASE_URL;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (!url || seenUrls.has(url)) {
      console.log("Repeated or empty page URL. Stop.");
      break;
    }

    seenUrls.add(url);
    console.log(`Fetching Metainmo page ${page}: ${url}`);

    const html = await fetchHtml(url);
    const rawPageProjects = await extractProjectsFromList(html);
    const pageProjects = dedupeRawProjects(rawPageProjects);

    console.log(`Page ${page} projects found: ${pageProjects.length}`);

    if (!pageProjects.length) {
      console.log("No projects on this page. Stop.");
      break;
    }

    const signature = pageProjects.map(p => `${p.slug}:${p.sourceUrl}`).join("|");
    if (seenPageSignatures.has(signature)) {
      console.log("Repeated page content detected. Stop.");
      break;
    }

    seenPageSignatures.add(signature);
    allRaw.push(...pageProjects);

    const nextUrl = getNextPageUrl(html, url);
    if (nextUrl && !seenUrls.has(nextUrl)) {
      url = nextUrl;
    } else {
      const fallback = getFallbackPageUrl(BASE_URL, page + 1);
      if (fallback && !seenUrls.has(fallback)) url = fallback;
      else {
        console.log("No next page. Stop.");
        break;
      }
    }

    await sleep(DELAY_MS);
  }

  const uniqueRaw = dedupeRawProjects(allRaw);
  console.log("Found public projects total:", uniqueRaw.length);

  const imported = uniqueRaw.map(toProject).filter(project => project.slug && project.title);
  const result = mergeProjects(current, imported);

  fs.writeFileSync(projectsPath, JSON.stringify(result.projects, null, 2), "utf8");

  console.log("Added:", result.added);
  console.log("Updated:", result.updated);
  console.log("Total:", result.projects.length);
  console.log("Done:", projectsPath);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
