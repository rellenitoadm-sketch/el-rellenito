// Parses src/lib/products.ts and emits a transactional SQL replace for the products table.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/lib/products.ts', import.meta.url), 'utf8');

// Isolate the array literal: from `export const products: Product[] = [` to the matching `];`
const start = src.indexOf('export const products');
const arrStart = src.indexOf('[', start);
const arrEnd = src.indexOf('\n];', arrStart);
// Strip whole-line `//` comments (category headers) so they don't break the split.
const body = src.slice(arrStart + 1, arrEnd).replace(/^\s*\/\/.*$/gm, '');

// Objects are flat (no nested braces) → split on `},  {`.
const blocks = body.split(/\},\s*\{/).map((b, i, a) => {
  let s = b;
  if (i > 0) s = '{' + s;
  if (i < a.length - 1) s = s + '}';
  return s;
});

function field(block, key) {
  const re = new RegExp(`${key}:\\s*('([^']*)'|"([^"]*)"|true|false|null|-?[0-9.]+)`);
  const m = block.match(re);
  if (!m) return undefined;
  const raw = m[1];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (m[2] !== undefined) return m[2];
  if (m[3] !== undefined) return m[3];
  return Number(raw);
}

const esc = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const num = (v) => v === null || v === undefined ? '0' : String(v);
const numOrNull = (v) => v === null || v === undefined ? 'NULL' : String(v);
const bool = (v) => v ? 'true' : 'false';

const rows = [];
for (const block of blocks) {
  const id = field(block, 'id');
  if (!id) continue;
  rows.push(
    `(${esc(id)}, ${esc(field(block, 'name'))}, ${esc(field(block, 'units'))}, ${esc(field(block, 'description'))}, ` +
    `${esc(field(block, 'category'))}, ${esc(field(block, 'type'))}, ` +
    `${num(field(block, 'price_usd'))}, ${num(field(block, 'wholesale_price_usd'))}, ` +
    `${numOrNull(field(block, 'price_cop'))}, ${numOrNull(field(block, 'wholesale_price_cop'))}, ` +
    `${bool(field(block, 'available'))}, ${esc(field(block, 'image_url'))}, ${bool(field(block, 'is_best_seller'))})`
  );
}

const sql =
  `-- Reemplazo completo del catálogo (generado desde src/lib/products.ts)\n` +
  `BEGIN;\n` +
  `DELETE FROM products;\n` +
  `INSERT INTO products (id, name, units, description, category, type, price_usd, wholesale_price_usd, price_cop, wholesale_price_cop, available, image_url, is_best_seller) VALUES\n` +
  rows.join(',\n') +
  `;\n` +
  `COMMIT;\n`;

writeFileSync(new URL('./seed-products.sql', import.meta.url), sql);
console.log(`Generated ${rows.length} product rows.`);
