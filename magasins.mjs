// Liste des SUPERMARCHÉS de France (métropole et outre-mer), tirée d'OpenStreetMap (licence ODbL),
// publiée chaque semaine dans magasins.json pour NutriFive. L'app y cherche ceux qui sont à moins de
// 20 km de la position du téléphone : recherche instantanée, et indépendante des serveurs Overpass
// publics, mesurés très lents ou en panne le 18/10/2026 (35 s pour une toute petite requête).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SERVEURS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
// Sortie CSV avec seulement les colonnes utiles : quelques Mo au lieu de dizaines en JSON complet.
const QUERY = `[out:csv(::type, ::id, ::lat, ::lon, name, brand, "addr:city"; false; "\\t")][timeout:900];
area["ISO3166-1"~"^(FR|GP|MQ|GF|RE|YT)$"]->.fr;
nwr["shop"="supermarket"](area.fr);
out center;`;
const MINIMUM = 5000;   // moins que ça = réponse coupée ou requête cassée : on ne publie pas un fichier creux

async function overpass() {
  let dernier = '';
  for (const url of SERVEURS) {
    for (let essai = 1; essai <= 2; essai++) {
      try {
        const r = await fetch(url, {
          method: 'POST', signal: AbortSignal.timeout(20 * 60_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NutriFive-magasins (releve hebdomadaire ; github.com/pistonmariodominique-ui/nutrifive-prix)' },
          body: `data=${encodeURIComponent(QUERY)}`,
        });
        const txt = await r.text();
        if (r.ok && !/runtime error|Too Many Requests/i.test(txt.slice(0, 500))) return { txt, url };
        dernier = `${url.split('/')[2]} : HTTP ${r.status} ${txt.slice(0, 120).replace(/\s+/g, ' ')}`;
      } catch (e) { dernier = `${url.split('/')[2]} : ${e.name === 'TimeoutError' ? 'trop lent' : e.message}`; }
      console.log(`échec (${dernier}), essai suivant…`);
      await new Promise(r => setTimeout(r, 60_000));
    }
  }
  throw new Error(`Aucun serveur Overpass n'a répondu : ${dernier}`);
}

const t0 = Date.now();
const { txt, url } = await overpass();
const vus = new Set(), items = [];
for (const ligne of txt.split('\n')) {
  const [type, id, lat, lon, name, brand, city] = ligne.split('\t');
  const nom = (name || brand || '').trim();
  if (!type || !nom || !lat || !lon || vus.has(`${type}${id}`)) continue;
  vus.add(`${type}${id}`);
  const marque = (brand || '').trim();
  items.push([Number(Number(lat).toFixed(5)), Number(Number(lon).toFixed(5)), nom, marque && marque !== nom ? marque : '', (city || '').trim()]);
}
if (items.length < MINIMUM) throw new Error(`Seulement ${items.length} supermarchés lus : réponse incomplète, rien n'est publié.`);
items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);   // ordre fixe : d'une semaine à l'autre, le fichier ne change que là où OSM a changé

const date = new Date().toISOString().slice(0, 10);
if (existsSync('magasins.json')) {
  const old = JSON.parse(readFileSync('magasins.json', 'utf8'));
  if (JSON.stringify(old.items) === JSON.stringify(items)) { console.log(`Rien de neuf : ${items.length} supermarchés, identiques.`); process.exit(0); }
}
writeFileSync('magasins.json', JSON.stringify({
  source: 'OpenStreetMap (licence ODbL, © les contributeurs OpenStreetMap) — shop=supermarket, France et outre-mer',
  colonnes: ['lat', 'lon', 'nom', 'enseigne', 'ville'], date, serveur: url.split('/')[2], items,
}));
const outreMer = items.filter(i => i[0] < 30).length;
console.log(`${items.length} supermarchés (dont ${outreMer} outre-mer) · ${(readFileSync('magasins.json').length / 1e6).toFixed(2)} Mo · ${((Date.now() - t0) / 1000).toFixed(0)} s via ${url.split('/')[2]}`);
