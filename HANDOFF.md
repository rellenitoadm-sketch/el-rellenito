# HANDOFF — El Rellenito (→ nueva sesión)

> Fecha: 2026-06-14 · Estado: feature **"bloqueo por moneda" SIN commitear** (typecheck verde, verificado en vivo). Build base: commit `221b72e`.

Lee esto primero para no re-explorar. Para el detalle histórico (PWA, alertas admin, a11y) ver `git show 221b72e`.

---

## 0. Rutas + cómo correr (Windows)
- **Código real:** `D:\Claude\claude-webkit\site` — Next.js **16.2.6** (Turbopack) + Supabase + Tailwind v4 + framer-motion. Mobile-first (`.app-shell` max 480px). `site/` es su **propio repo git** (local, sin remoto), ignorado por el repo padre.
- **Catálogo REAL:** `site/src/lib/products.ts` → **99 productos**, 9 categorías (Tequeños, Pasapalos, Masas, Cafetín, Panadería, Salsas, Bebidas, Postres, Combos). ⚠️ `site-src-prep/` es una carpeta vieja de 86 productos — **ignorar/no usar**.
- **Correr:** preview MCP `preview_start` name **`rellenito`** (puerto 3000). Ya existe `.claude/launch.json`. Next compila en el 1er request (~10-20s) → poll a `http://localhost:3000` antes de screenshot.
- **Windows gotchas:** ExecutionPolicy bloquea `.ps1` → llamar binarios directo (`& "C:\Program Files\nodejs\npm.cmd"`, `npx.cmd`, `node.exe`). **El tool Bash no devuelve output en este entorno → usar PowerShell.** Grep/ripgrep se cuelga con el dev server corriendo → usar Read directo.
- **Build:** `npm.cmd run build`. **Typecheck:** `.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json` (desde `site/`, con Push-Location).
- **Admin:** PIN `150101`. Entrar: **5 taps en el logo del TopBar** → pinpad. O `POST /api/admin/login {pin:"150101"}` → `/admin/dashboard`.

---

## 1. EN CURSO (sin commitear) — Bloqueo por moneda
**Regla:** un producto sin precio nativo en la moneda activa queda **bloqueado, NO se convierte**. COP necesita `price_cop`; USD y Bs dependen de `price_usd` (Bs se deriva del USD). Hoy solo afecta a los **6 postres** (solo USD) → bloqueados en COP.

- **Helper (fuente única):** `site/src/lib/rates.ts` → `isPricedIn(p, currency)`, `cartTotals(items, currency, rates)`, `CURRENCY_NAME`.
- **Archivos tocados (6):** `lib/rates.ts`, `components/ProductCard.tsx`, `Cart.tsx`, `CartButton.tsx`, `Upsell.tsx`, `WholesalePage.tsx`.
- **UX:** tarjeta bloqueada = candado + "No disponible en {moneda}" + sin botón Agregar. Carrito = ítem marcado, excluido del total, checkout deshabilitado + banner "Quitar no disponibles". Igual en mayorista.
- **Verificado:** `tsc` verde. En vivo (preview MCP eval): en COP los 6 postres bloqueados; en USD aparecen con su precio real. Carrito/mayorista por lógica (mismo helper) — el dropdown de moneda no se deja manejar bien en preview headless.
- **Detalle menor:** el atenuado `opacity:0.55` lo pisa la animación de framer (cosmético; el bloqueo se comunica con candado+label+botón). Si se quiere atenuar de verdad, pasar opacity por el `animate` de framer.
- **Decisión del usuario:** NO tocar precios. Solo bloquear monedas. Productos con mayor=detal o solo-COP: dejarlos.

**Pendiente inmediato:** preguntar al usuario si commitea estos 6 archivos.

---

## 1b. EN CURSO (sin commitear) — Fixes panel admin + tasas (14-jun-2026)
Pedidos del usuario, todos verificados (`tsc` verde + preview MCP en vivo):
1. **Dirección manual al mayor** (`WholesalePage.tsx`): el checkout mayorista solo tenía GPS. Ahora hay campo de texto "Dirección de entrega" siempre visible; el GPS quedó opcional debajo. `delivery_type='delivery'` si hay dirección escrita o GPS.
2. **Tasa BCV/COP siempre visible + recarga manual** (`admin/ProductsPanel.tsx`): barra fija arriba del buscador con `1 USD = Bs X · COP Y` + hora + botón recargar. El botón llama `/api/rates?refresh=1`.
3. **Fuentes de tasa CORREGIDAS** (`lib/rates.ts`, `api/rates/route.ts`): el BCV salía mal (582 vs oficial 587). **`ve.dolarapi.com/v1/dolares/oficial` campo `promedio` = BCV oficial EXACTO** → ahora va de PRIMERA fuente (pydolarve quedó de respaldo, iba atrasado/caído). COP ya no está hardcodeado a 4200 → se consulta en vivo (`open.er-api.com` → `rates.COP`, fallback `currency-api`); hoy ~3503. Nuevo `fetchCopRate()`; `getExchangeRates()` trae ambos en paralelo. `/api/rates?refresh=1` ignora el caché del día. Fallbacks internos: Bs 587.41, COP 3500. **COP solo es informativo** (no afecta precios de productos: los sin `price_cop` quedan bloqueados en COP, no se convierten).
4. **Bug label COP en editor** (`admin/ProductEditor.tsx`): el "COP" pisaba el input → padding-left 2.75rem→3.25rem + `pointer-events-none z-10` en el span (detal y mayor).
5. **Cuadrícula por defecto** (`page.tsx`): `viewMode` inicial `'list'`→`'grid'`.
6. **Categoría "Incompletos"** (`admin/ProductsPanel.tsx`): chip amarillo `⚠️ Incompletos (N)` que filtra productos a los que les falta unidades/descripción/precio USD-COP detal-mayor (helper `getMissingFields`). NO mueve el producto de su categoría real; muestra etiquetas "Sin {campo}". Hoy 6 incompletos.

**Pendiente inmediato:** decidir commit de TODO lo de §1 + §1b (mismo repo `site/`).

---

## 2. Pendientes
- [ ] **Fotos de los 99 productos** → se suben por el **panel admin** (bucket Supabase `product-images`, vía `/api/admin/upload`). NO nombrar archivos por id. Excel guía ya generado: `D:\Claude\claude-webkit\El-Rellenito-productos-fotos.xlsx` (99 productos, best-sellers marcados, columna "¿Foto lista?").
- [ ] **Emojis → iconos SVG** en headings de categoría (`categoryEmoji` en `products.ts`; usado en ProductList, WholesalePage, ProductsPanel, MetricsPanel). Elegir set Lucide para las 9 categorías. Único ítem de auditoría a11y sin hacer.
- [ ] **MemPalace** / **claude-mem** (instalación bloqueada para el agente, requiere acción del usuario).

---

## 3. Análisis de precios (HECHO — no re-derivar)
El usuario pidió analizar precios; se encontraron estas incoherencias (decidió **no** corregirlas por ahora, solo el bloqueo por moneda):
- `combo-torta-1kg` 15.00 USD < `torta-1kg` 17.19 USD (combo más barato en USD, pero más caro en COP 57k vs 40k) → typo probable.
- `biscocho-1kg` 6.81 USD ≈ `biscocho-medio-kg` 6.45 USD (el kilo casi igual al medio) → typo probable.
- 14 productos con descuento al mayor en una moneda y no en la otra.
- Dos "tasas" COP/USD implícitas: ~2.300 (general) vs ~3.600 (Cafetín + algunas bebidas).
- 6 postres sin `price_cop` (intencional → quedan bloqueados en COP, ver §1).
- Scripts reusables: `site-src-prep/analiza_precios.py` y `export_productos.py` (parsean `products.ts`; requieren `openpyxl`).

---

## 4. Datos clave del sistema
- Productos cargan de `/api/products` (Supabase) con **fallback estático** `products.ts` (`ProductsContext`). Edits del admin se reflejan vía API.
- Monedas: COP (default), USD, Bs. `CurrencyContext` + `rates.ts`. Tasa BCV en vivo vía `/api/rates` (BCV=`ve.dolarapi.com/oficial`.promedio; COP=`open.er-api.com`.rates.COP; cron `api/cron/refresh-rate`); fallback interno Bs 587.41, COP 3500. Ver §1b.
- Trigger mayorista: cantidad ≥ 10 del mismo producto conmuta a `wholesale_*`.

---

## 5. Cómo retomar
1. `preview_start` name `rellenito` → poll `http://localhost:3000`.
2. Antes de cerrar cualquier cambio UI: `tsc --noEmit` verde + verificar por preview MCP (eval/screenshot).
3. Decidir con el usuario el commit de la feature de moneda (§1).
