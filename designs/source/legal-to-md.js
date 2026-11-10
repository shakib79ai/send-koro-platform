// Writes docs/legal/*.md from designs/source/legal.js. Usage: node designs/source/legal-to-md.js docs/legal
const fs = require('fs'); const path = require('path');
const window = {}; eval(fs.readFileSync(path.join(__dirname, 'legal.js'), 'utf8'));
const { DOCS, SETS, UPDATED } = window.SK_LEGAL; const out = process.argv[2] || 'docs/legal';
const md = (h) => h.replace(/<button class="lg-link"[^>]*data-id="([^"]+)"[^>]*>(.*?)<\/button>/g, (m, id, t) => `[${t}](${id}.md)`)
  .replace(/<div class="lg-tbl"><table><thead><tr>(.*?)<\/tr><\/thead><tbody>(.*?)<\/tbody><\/table><\/div>/gs, (m, hd, bd) => { const hs = [...hd.matchAll(/<th>(.*?)<\/th>/g)].map((x) => x[1]); const rows = [...bd.matchAll(/<tr>(.*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td>(.*?)<\/td>/g)].map((x) => x[1].replace(/\|/g, '/'))); return `\n| ${hs.join(' | ')} |\n|${hs.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`; })
  .replace(/<ol>(.*?)<\/ol>/gs, (m, x) => '\n' + [...x.matchAll(/<li>(.*?)<\/li>/gs)].map((l, i) => `${i + 1}. ${l[1]}`).join('\n') + '\n')
  .replace(/<ul>(.*?)<\/ul>/gs, (m, x) => '\n' + [...x.matchAll(/<li>(.*?)<\/li>/gs)].map((l) => `- ${l[1]}`).join('\n') + '\n')
  .replace(/<p>(.*?)<\/p>/gs, '\n$1\n').replace(/<\/?b>/g, '**').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n');
fs.mkdirSync(out, { recursive: true });
const AUD = { customer: 'Customers (web, PWA, iOS and Android apps)', restaurant: 'Restaurants (portal web and PWA)', driver: 'Couriers (driver app)' };
let idx = `# Send Koro legal documents\n\nFinal texts, in effect from ${UPDATED}. Send Koro is a DBA of **SHL Global Consulting Inc.**, 1088 Liberty Ave, Brooklyn, NY 11208 · info@sendkoro.com.\n\nThese texts are shown in every app (source: \`designs/source/legal.js\`; regenerate with \`node designs/source/legal-to-md.js docs/legal\`). They are written for Send Koro’s business model, organised the way large delivery marketplaces organise theirs.\n\n| Document | For | File |\n|---|---|---|\n`;
Object.entries(DOCS).forEach(([id, d]) => { idx += `| ${d.title} | ${d.who.map((w) => w[0].toUpperCase() + w.slice(1)).join(', ')} | [${id}.md](${id}.md) |\n`;
  fs.writeFileSync(path.join(out, id + '.md'), `# ${d.title}\n\n_Last updated ${UPDATED} · SHL Global Consulting Inc., doing business as Send Koro_\n\n${d.short}.\n\n` + d.sections.map(([h, b], i) => `## ${i + 1}. ${h}\n${md(b)}`).join('\n')); });
idx += `\n## Where each document appears\n\n` + Object.entries(SETS).map(([k, ids]) => `- **${AUD[k]}:** ${ids.map((i) => DOCS[i].title).join(', ')}`).join('\n') + `\n\n- Customers: sign-in consent line, checkout (“By placing your order…”), website footer, Account → Legal, Account → Privacy center (marketing choices, cookies, download data, delete account).\n- Restaurants: sign-up “Agree” step, portal footer, Licenses and legal page, More / sidebar → Legal documents.\n- Couriers: sign-in consent line, application agreement step, Account → Legal and Your data, Help → Legal.\n`;
fs.writeFileSync(path.join(out, 'README.md'), idx); console.log('wrote', Object.keys(DOCS).length + 1, 'files');
