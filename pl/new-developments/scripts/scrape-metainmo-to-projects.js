const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://spain.metainmo.com/pl/alicante/promociones";
const REPO_ROOT = process.cwd();
const OUT = path.join(REPO_ROOT, "pl", "new-developments", "projects.json");

const MAX_PAGES = Number(process.env.MAX_PAGES || 80);
const DELAY_MS = Number(process.env.DELAY_MS || 600);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function clean(v=""){
  return String(v)
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#039;|&#39;/gi,"'")
    .replace(/&euro;/gi,"€")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function slugify(v=""){
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/ł/g,"l")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,90);
}

function absUrl(url, base=BASE_URL){
  const raw = String(url || "").trim();
  if (!raw || raw.startsWith("data:")) return "";
  try { return new URL(raw, base).href; } catch { return ""; }
}

function isGoodImage(url=""){
  return /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(url)
    && !/logo|avatar|placeholder|favicon|sprite|icon|svg|base64|blank|loading/i.test(url);
}

function addImage(list, url, base){
  const full = absUrl(url, base);
  if (!isGoodImage(full)) return;
  if (!list.includes(full)) list.push(full);
}

function extractImages(html, base){
  const images = [];
  let m;

  const attrs = /(?:src|data-src|data-lazy-src|data-original|data-full|data-image|href)=["']([^"']+)["']/gi;
  while ((m = attrs.exec(html))) addImage(images, m[1], base);

  const srcsets = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((m = srcsets.exec(html))) {
    m[1].split(",").map(x => x.trim().split(/\s+/)[0]).forEach(u => addImage(images, u, base));
  }

  const direct = /https?:\\?\/\\?\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  while ((m = direct.exec(html))) addImage(images, m[0].replace(/\\\//g, "/"), base);

  return [...new Set(images)];
}

function priceValue(price=""){
  const m = String(price).replace(/\s/g,"").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function extractPrice(text=""){
  const t = clean(text);
  const m = t.match(/[\d\s]{3,}\s*€\s*-\s*[\d\s]{3,}\s*€/i) || t.match(/(?:od\s*)?[\d\s]{3,}\s*€/i);
  return m ? clean(m[0]).replace(/\s+€/g," €") : "Cena na zapytanie";
}

function detectCity(text=""){
  const t = clean(text).toLowerCase();
  const map = [
    ["torrevieja","torrevieja"],["calpe","calpe"],["kalpe","calpe"],
    ["benidorm","benidorm"],["finestrat","finestrat"],["polop","polop"],
    ["guardamar","guardamar"],["villajoyosa","villajoyosa"],["vila joiosa","villajoyosa"],
    ["alicante","alicante"],["pilar de la horadada","pilar-de-la-horadada"],
    ["torre de la horadada","pilar-de-la-horadada"],["orihuela","orihuela"],
    ["rojales","rojales"],["denia","denia"],["dénia","denia"],
    ["javea","javea"],["jávea","javea"],["xàbia","javea"],
    ["altea","altea"],["moraira","moraira"],["benissa","benissa"],
    ["benitachell","benitachell"],["santa pola","santa-pola"],
    ["san fulgencio","san-fulgencio"],["algorfa","algorfa"],["daya nueva","daya-nueva"]
  ];
  const found = map.find(([needle]) => t.includes(needle));
  return found ? found[1] : "alicante";
}

function prettyLocation(key){
  const map = {
    alicante:"Alicante", torrevieja:"Torrevieja", calpe:"Calpe", benidorm:"Benidorm",
    finestrat:"Finestrat", polop:"Polop", guardamar:"Guardamar", villajoyosa:"Villajoyosa",
    "pilar-de-la-horadada":"Pilar de la Horadada", orihuela:"Orihuela Costa",
    rojales:"Rojales", denia:"Dénia", javea:"Jávea / Xàbia", altea:"Altea",
    moraira:"Moraira", benissa:"Benissa", benitachell:"Benitachell",
    "santa-pola":"Santa Pola", "san-fulgencio":"San Fulgencio", algorfa:"Algorfa",
    "daya-nueva":"Daya Nueva"
  };
  return map[key] || "Costa Blanca";
}

async function fetchHtml(url){
  const res = await fetch(url, {
    headers:{
      "user-agent":"Mozilla/5.0 Costa-Blanca-Invest-Importer",
      "accept":"text/html,application/xhtml+xml",
      "accept-language":"pl-PL,pl;q=0.9,es;q=0.8,en;q=0.7"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.text();
}

function collectBlocks(html){
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let m;

  while ((m = re.exec(html))) {
    const href = absUrl(m[1]);
    const text = clean(m[2]);
    if (
      href.includes("metainmo.com") &&
      (
        /nowa inwestycja/i.test(text) ||
        /promocja\s+w/i.test(text) ||
        /subskrypcj/i.test(text) ||
        /zobaczyć tę nieruchomość/i.test(text)
      )
    ) anchors.push({href, index:m.index, text});
  }

  return anchors.map((a,i) => ({
    href:a.href,
    text:a.text,
    block:html.slice(a.index, anchors[i+1]?.index || Math.min(html.length, a.index + 12000))
  }));
}

function titleFromBlock(text, index){
  const t = clean(text);
  const named = t.match(/Nowa inwestycja\s+(.+?)\s+promocja\s+w/i);
  if (named) return clean(named[1]);

  const fromDescription = t.match(/Nieruchomość w\s+(.+?)\s+(Zlokalizowana|W samym|Nowy|Odkryj|Ekskluzywna|Mieszkaj|Na sprzedaż)/i);
  if (fromDescription && !/xxxxxxxx/i.test(fromDescription[1])) return clean(fromDescription[1]);

  const city = clean(t.match(/Alicante,\s*([^,\n]+)/i)?.[1] || "Costa Blanca");
  return `Nowa inwestycja ${city} ${index + 1}`;
}

function extractArea(text){
  const m = clean(text).match(/m2 zabudowane:\s*([\d.,]+\s*m²?)/i);
  return m ? m[1].replace(/m2/i,"m²") : "";
}

function extractRooms(text){
  const m = clean(text).match(/(\d+)-pokojowe/i);
  return m ? `${m[1]} pokoje` : "";
}

function toProject(raw, index){
  const text = clean(raw.block);
  const images = extractImages(raw.block, raw.href);
  if (!images.length) return null;

  const title = titleFromBlock(text, index);
  const slug = slugify(title) || `metainmo-${index + 1}`;
  const price = extractPrice(text);
  const cityKey = detectCity(text);
  const location = prettyLocation(cityKey);

  const desc = clean(
    text
      .replace(/Kontakt.*$/i,"")
      .split(/\d+\s+jednostk[ai]/i).pop() || ""
  ).slice(0, 260);

  return {
    slug,
    title,
    sourceUrl: raw.href,
    image: images[0],
    images,
    href: `/pl/new-developments/xml-catalog/?slug=${slug}`,
    price,
    priceValue: priceValue(price),
    filterLocation: cityKey,
    meta: `${location} · Costa Blanca`,
    desc: desc || `${title} — nowa inwestycja na Costa Blanca.`,
    chip: "Nowa inwestycja",
    params: {
      Lokalizacja: location,
      Typ: "Apartamenty / Wille",
      Powierzchnia: extractArea(text) || "na zapytanie",
      Pokoje: extractRooms(text) || "różne układy",
      Cena: price
    },
    seoTitle: `${title} | Costa Blanca Invest`,
    seoDescription: `${title} · ${location} · ${price}. Nowa inwestycja Costa Blanca z galerią zdjęć, parametrami i szybkim kontaktem.`,
    translations: {
      pl: { title, meta: `${location} · Costa Blanca`, price, desc: desc || `${title} — nowa inwestycja na Costa Blanca.` },
      en: { title, meta: `${location} · Costa Blanca`, price, desc: `${title} — selected new development on the Costa Blanca.` },
      es: { title, meta: `${location} · Costa Blanca`, price, desc: `${title} — promoción seleccionada en la Costa Blanca.` },
      ru: { title, meta: `${location} · Costa Blanca`, price, desc: `${title} — новый проект на Costa Blanca.` }
    }
  };
}

function nextUrl(current, page){
  const url = new URL(BASE_URL);
  url.searchParams.set("page", String(page));
  return url.href;
}

async function main(){
  fs.mkdirSync(path.dirname(OUT), {recursive:true});

  const all = [];
  const seen = new Set();

  for (let page=1; page<=MAX_PAGES; page++){
    const url = page === 1 ? BASE_URL : nextUrl(BASE_URL, page);
    console.log("Fetch:", url);

    const html = await fetchHtml(url);
    const blocks = collectBlocks(html);
    if (!blocks.length) break;

    blocks.forEach((block, i) => {
      const project = toProject(block, all.length + i);
      if (!project) return;
      const key = project.sourceUrl + "|" + project.slug;
      if (seen.has(key)) return;
      seen.add(key);
      all.push(project);
    });

    console.log("Total:", all.length);
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), "utf8");
  console.log("Saved:", OUT);
  console.log("Projects with real images:", all.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
