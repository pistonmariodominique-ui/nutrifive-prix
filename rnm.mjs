// Relevé hebdomadaire des prix de détail en supermarché (GMS) publiés par le RNM
// de FranceAgriMer (service public). Écrit rnm.json, lu par l'app NutriFive.
// Le site RNM n'autorise pas les appels depuis un navigateur (pas de CORS) : ce script
// tourne chaque semaine sur GitHub Actions et publie un fichier statique.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MARKETS = { M2502: 'Légumes', M2503: 'Fruits', M2501: 'Viande', M2500: 'Poisson', M2504: 'Lait et œufs' };
const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê').replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â')
  .replace(/&ocirc;/g, 'ô').replace(/&icirc;/g, 'î').replace(/&ucirc;/g, 'û').replace(/&ccedil;/g, 'ç').replace(/&Eacute;/g, 'É').replace(/&Ecirc;/g, 'Ê').replace(/&Icirc;/g, 'Î');
const strip = s => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** Unité lue dans le libellé : « (le litre) », « (la pièce) »… ; sinon le kilo (règle de la page). */
function unitOf(name) {
  const m = name.match(/\((l[ea]s?|l')\s*([^)]+)\)\s*$/i);
  if (!m) return 'kg';
  const u = m[2].trim().toLowerCase();
  return u === 'kg' ? 'kg' : u === 'litre' ? 'L' : u === 'pièce' ? 'pièce' : u;
}

const items = []; let date = null;
for (const [code, label] of Object.entries(MARKETS)) {
  const r = await fetch(`https://rnm.franceagrimer.fr/prix?${code}:MARCHE`, { headers: { 'User-Agent': 'NutriFive-prix (releve hebdomadaire)' } });
  if (!r.ok) throw new Error(`${code} : HTTP ${r.status}`);
  const html = await r.text();
  const d = html.match(/(\d\d)\/(\d\d)\/(\d\d)/);
  if (d) { const iso = `20${d[3]}-${d[2]}-${d[1]}`; if (!date || iso > date) date = iso; }
  let n = 0;
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const a = row.match(/<a[^>]*>([\s\S]*?)<\/a>/), st = row.match(/<strong[^>]*>([\s\S]*?)<\/strong>/);
    if (!a || !st) continue;
    const name = strip(a[1]), price = Number(strip(st[1]).replace(',', '.'));
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    items.push({ market: label, name, price, unit: unitOf(name) }); n++;
  }
  // Une page vide = la page a changé de forme : on échoue plutôt que publier un fichier creux.
  if (!n) throw new Error(`${code} (${label}) : aucun prix lu, la page a peut-être changé`);
}
// Même semaine, mêmes prix : on ne réécrit pas le fichier. Avant le 18/10/2026, seule l'heure
// « generated » changeait et la tâche publiait un faux « nouveau relevé » (commit du 15/10).
if (existsSync('rnm.json')) {
  const old = JSON.parse(readFileSync('rnm.json', 'utf8'));
  if (old.date === date && JSON.stringify(old.items) === JSON.stringify(items)) {
    console.log(`Rien de neuf : relevé du ${date} déjà publié (${items.length} prix).`);
    process.exit(0);
  }
}
writeFileSync('rnm.json', JSON.stringify({
  source: 'RNM FranceAgriMer — cours de détail en grandes et moyennes surfaces (prix moyens TTC)',
  url: 'https://rnm.franceagrimer.fr', date, generated: new Date().toISOString(), items,
}, null, 1));
console.log(`${items.length} prix, relevés du ${date}`);
