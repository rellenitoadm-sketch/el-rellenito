# HANDOFF — El Rellenito (→ nueva sesión)

> **Actualizado 2026-06-18.** La sección ⭐ de abajo es lo VIGENTE. El resto del archivo (desde "Fecha: 2026-06-14") es historial.

---

## ⭐ ESTADO 2026-06-18 — Ampliación Fase 1+2 + lote UI HECHOS (sin commitear) · 6 pendientes nuevos

### Hecho esta sesión (todo verificado con `next build` exit 0; NO verificado a fondo en navegador salvo el Home)
**Fase 1 — datos/lógica:**
- `products.limite_unidades_mayor` (int NOT NULL default 10) = umbral mayorista POR PRODUCTO. Helpers en `lib/rates.ts`: `wholesaleThreshold(p)`, `isWholesaleQty(qty, limit)`; threaded en `unitUsd/unitCop/cartTotals`, `CartItem`, `Cart.tsx`, `Checkout.tsx`. Editable en `admin/ProductEditor.tsx` ("Mínimo de unidades para precio al mayor") + whitelist en API.
- Categoría `PIZZERIA` + 6 pizzas; 6 combos de evento `combo-evento-1..6` (precio fijo). USD derivado de COP (~3500), editable en admin.

**Fase 2 — IA/UX:**
- 3 vistas en `app/page.tsx`: `home|detal|mayor` (default `home`). `Home.tsx` informativo: hero con 2 CTAs SÓLIDAS "Pedidos al Detal" / "Pedidos al Mayor" + descripción + Footer. SIN tarjetas, SIN video, SIN conteo de reseñas.
- **Acceso admin = 5 toques en el LOGO GRANDE del hero** (`Header.tsx`); el logo pequeño del `TopBar` ahora va a Inicio.
- Modal de producto `ProductModal.tsx` (detal + mayor con precio correcto; toggle de fritos).
- Recargo de fritos: columna `products.cobra_frito` (default Tequeños+Pasapalos; exentos `tequeno-mini-combo` y `cafetin-pastelitos`). `lib/fritos.ts` → `FRITO_SURCHARGE {usd:0.8, cop:2000}`. Toggle en modal + por línea en carrito; suma en totales/checkout; flag `fritos` en order items; toggle "Cobra servicio de fritos" en admin.
- Al Mayor (`WholesalePage.tsx`) con paridad: **buscador + selector de moneda + toggle lista/cuadrícula** (reusa `FilterRow`) + vista grid + estado vacío.
- Onboarding `Onboarding.tsx`: tours `home, catalog, mayor, cart, checkout, admin` (LocalStorage `rl_tour_{id}_v2`, una vez c/u). Con motion (spotlight resorte + anillo que late + tarjeta por paso). Triggers: `page.tsx` (home/catalog), `WholesalePage` (mayor), `Cart` (cart), `Checkout` (checkout), `admin/dashboard` (admin). Anclas `data-tour=...`.
- Gravix: headings de categoría a solo texto; placeholders sin foto = inicial del nombre; sin emoji al crear categoría.

**Migraciones Supabase YA APLICADAS** (proyecto `cbmkqumcsgieivffiody`): `limite_unidades_mayor`, `cobra_frito`, categoría PIZZERIA + 12 productos. `database.types.ts` regenerado a mano (incluye tabla `categories`).

### GIT — IMPORTANTE
- Commit `35dd713` (main) tiene Fase 1+2 **PERO con un bug de tipos `cobra_frito` que ROMPE `next build`**.
- El **working tree tiene el FIX + TODO el lote UI, sin commitear** → la nueva sesión debe **commitear el working tree** (incluye el fix y `HANDOFF.md`).
- Autor configurado: `rellenito.adm@gmail.com` (requerido para deploy Vercel Hobby — ver memoria). Repo `site/` = `github.com/rellenitoadm-sketch/el-rellenito`; push a `main` → auto-deploy Vercel (elrellenito.com). **NO se ha hecho push.**

### CÓMO CORRER / PREVIEW (clave en esta máquina)
- El **dev server (`next dev` Turbopack) es INESTABLE aquí**: se reinicia por umbral de memoria + disco D: lento → la pestaña del navegador queda en `chrome-error`. El preview MCP (`preview_start`) NO es fiable.
- **Usar BUILD DE PRODUCCIÓN para preview:** `& "C:\Program Files\nodejs\npm.cmd" run build` y luego `... run start` (en background) → **http://localhost:3000 estable** (next start, sin recompilaciones). Verificar con `node -e "fetch('http://localhost:3000/').then(r=>r.text()).then(...)"`.
- **`next build` es MÁS ESTRICTO que `tsc --noEmit`** (atrapó el bug `cobra_frito`). SIEMPRE validar con `next build`, no solo tsc.
- **Gotcha de tipos:** columnas NOT NULL de Supabase (`cobra_frito`, `limite_unidades_mayor`) NO tiparlas `| null` en el tipo `Product` (rompe el `.update(patch)` tipado de supabase-js en `next build`).
- Antes de tocar código: `site/AGENTS.md` advierte que este Next 16 tiene breaking changes (leer `node_modules/next/dist/docs/` si se tocan rutas/SSR).

### PENDIENTES NUEVOS (2026-06-18) — ✅ TODOS HECHOS (parte 2, sin commitear; `next build` exit 0)
Verificado con `tsc --noEmit` + `next build` (ambos exit 0) y smoke test del build de producción (Home/Admin → 200, ancla `home-menu` presente en el HTML). NO probado a fondo en navegador (tours son gated por localStorage `rl_tour_*_v2` + animaciones).
1. ✅ **Tours de carrito/checkout completos, detal Y mayor.** `Onboarding.tsx`: tour `cart` ampliado (incluye explicación de fritos), tour `checkout` (detal) ampliado a 6 pasos (entrega, ubicación, datos, pago, resumen, confirmar) con anclas nuevas en `Checkout.tsx` (`checkout-delivery/location/data/summary`). Nuevo tour `wcheckout` para el checkout mayorista inline con anclas `wco-summary/date/data/payment/confirm` en `WholesalePage.tsx`; se dispara al abrir el checkout (`checkoutOpen`).
2. ✅ **Menú hamburguesa en Home y Al Mayor.** `NavMenu` ahora acepta `onCategory`/`onInfo`/`variant`/`triggerTour`. `Header` tiene slot `topLeft` (Home mete el menú ahí, anclaje `home-menu`). `WholesalePage` lo monta en su cabecera (anclaje `wmayor-menu`). `page.tsx` resuelve navegación cruzada: `goToDetalCategory` (categoría → abre detal y hace scroll) y `goToInfoSection` (info del footer; desde mayor vuelve a home).
3. ✅ **CookieBanner + InstallPrompt persisten.** Causa: compartían `z-90` con el overlay del tour y no había coordinación. Fix: `Onboarding` expone `activeTour`; ambos banners se ocultan SOLO mientras hay un tour activo y reaparecen al terminar (no se descartan). Overlay del tour subido a `z-100`; banners a `z-88`. Ya estaban montados en todas las vistas (`page.tsx` fuera del switch de vista).
4. ✅ **Tours admin por sección + panel STAFF.** `Onboarding`: tours `admin` (overview admin, presenta 4 secciones + recorre Pedidos), `adminStaff` (overview equipo, solo Pedidos/Productos), `adminProductos`, `adminMetricas`, `adminCrm`. Anclas añadidas en los 4 paneles (`orders-*`, `products-*`, `metrics-*`, `crm-*`). El dashboard arranca `admin` o `adminStaff` según rol y dispara el tour de sección al abrir cada pestaña (métricas/crm nunca para staff: las pestañas están ocultas).
5. ✅ **Toggle de fritos mejorado + aclaración.** `ProductModal`: "Pídelo ya frito · Te lo entregamos recién frito, listo para comer" con icono `Flame`. `Cart`: "Pedirlo frito" con icono + `aria-label`/`title` que aclaran "listo para comer". El tour `cart` explica que fritos = recibirlo YA FRITO.
6. ⛔ **Mínimo de unidades al mayor — REVERTIDO a pedido del usuario (2026-06-19).** Se había hecho (qty inicial = umbral, no bajar de ahí, pista "Mínimo N und.") pero el usuario pidió quitar la obligación de pedir el mínimo al mayor. El carrito mayorista volvió a su comportamiento original (empieza en 1, baja libremente). El campo `limite_unidades_mayor` SIGUE existiendo con su uso original: a partir de cuántas unidades aplica el precio al mayor (no es compra mínima).

### AJUSTES 2026-06-19 (pedidos del usuario; sin commitear hasta build verde)
- **Botón permanente "Instalar app" en el menú hamburguesa.** Nuevo contexto `components/PwaInstall.tsx` (`PwaInstallProvider` en `layout.tsx`, hook `usePwaInstall`) que captura UNA vez `beforeinstallprompt` y registra el SW. `NavMenu` muestra fila "Instalar app" (salvo standalone): Android lanza el prompt; iOS/otros muestran instrucciones inline. `InstallPrompt` (el banner) refactorizado para consumir el mismo contexto (ya no registra el SW él).
- **Tutorial de Productos también para STAFF.** Antes el tour `adminProductos` se marcaba visto por el admin y el equipo ya no lo veía (misma clave localStorage). Nuevo tour `adminStaffProductos` (clave propia); el dashboard dispara según rol (`role==='admin' ? adminProductos : adminStaffProductos`).
- **Tutorial dentro del editor de producto (nuevo/editar).** Nuevo tour `productEditor` con anclas `pe-image/name/category/price/type/fritos/flags/save` en `ProductEditor.tsx`; se dispara al abrir el editor (una vez).

### ⭐ DIRECCIÓN ESTRATÉGICA 2026-06-19 — dejar WhatsApp, la app como único canal
**Decisión del usuario:** dejar de usar WhatsApp como medio para manejar pedidos. **La página/app pasa a ser el ÚNICO canal** de gestión de pedidos (registro, seguimiento, confirmación de envío, cambios, incidencias). La automatización que viene **se hará en n8n**: un **agente** que responda PQRS, FAQs, problemas en pedidos y cambios, y que **escale a un humano cuando sea necesario**.

- **Hecho ahora:** se quitaron del **tutorial** (tours en `Onboarding.tsx`) todas las menciones de "te contactaremos por WhatsApp"/coordinar por WhatsApp → ahora dicen que el seguimiento es "en la app"/"aquí mismo"; los campos pasan a "número de contacto"; en admin, "contacto del cliente" en vez de "WhatsApp del cliente".
- **PENDIENTE (migración fuera de WhatsApp, NO hecho aún — es trabajo futuro):** todavía quedan referencias a WhatsApp en la app real fuera del tutorial:
  - Pantallas de éxito: `Checkout.tsx` ("te contactaremos ... por WhatsApp") y `WholesalePage.tsx` ("Te contactaremos por WhatsApp").
  - Copys de envío "se confirma por WhatsApp" en `Checkout.tsx`.
  - Enlaces `wa.me` en `Header.tsx`, `NavMenu.tsx` (Contacto), `Footer.tsx`, y botones de contacto en `OrdersPanel.tsx`/`CrmPanel.tsx` (admin).
  - El formulario sigue pidiendo "WhatsApp" como campo de contacto.
  Reemplazar por seguimiento/avisos in-app (estado del pedido en la app, notificaciones push ya existentes vía `StaffAlerts`/`web-push`) + el agente n8n. Definir con el usuario el flujo in-app antes de tocar esto.
- **Agente n8n (futuro):** responder PQRS/FAQs/incidencias/cambios de pedido y escalar a humano. Se conecta a los datos de pedidos (Supabase) y a la app como canal. Aún por diseñar.

### Issue conocido (de la revisión de código)
- Los **items del pedido NO incluyen el recargo de fritos en su `price_usd`/`price_cop` por línea** (los TOTALES sí). Si el admin/WhatsApp reconstruye desde líneas, no cuadra. Fix: meter el recargo en el precio de línea o añadir campo `frito_*`. Pendiente.

### Pendientes de datos del cliente
- USD exactos de pizzas/combos · precio de cada opción del Combo 2 · (pastelitos exento está a 7.000, no 8.000) · valor USD del recargo de fritos (hoy 0.8).

---

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

## 1c. DEPLOY + NOTIFICACIONES (commiteado, 15-jun-2026)
**Repo:** `https://github.com/rellenitoadm-sketch/el-rellenito` (privado). `site/` es ese repo. Push a `main` → auto-deploy en Vercel (proyecto `el-rellenito`, dominio **elrellenito.com** vía Namecheap: A `@`→216.198.79.1, CNAME `www`→cname.vercel-dns-0.com). ⚠️ El MCP de Vercel está en otra cuenta/scope (no ve el proyecto).

**Notificaciones push (nuevo):** `web-push` + VAPID. Tabla Supabase `push_subscriptions` (RLS, solo service_role). Flujo:
- `lib/push.ts` (envío), `api/admin/push` (suscribir/desuscribir), `POST /api/orders` envía push con conteo de pendientes.
- `public/sw.js` → handlers `push`/`notificationclick` + `setAppBadge`.
- `components/StaffAlerts.tsx` (montado en `layout.tsx`): provider global; solo se activa si `/api/admin/me` OK; suena el "ding" en cualquier pantalla (incl. catálogo), pinta badge, suscribe push. `OrdersPanel` delega en él (su campana dispara `rl-enable-alerts`/`rl-disable-alerts`; estado en localStorage `rl_admin_alerts`).
- ⚠️ **Vercel necesita 3 env vars** para que el push funcione en prod: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (están en `.env.local`). La PUBLIC es build-time → tras agregarlas hay que **Redeploy**.

**Otros fixes (mismo commit):** imagen footer (`/logo.png` 404 → `/logo-circle.png`); iconos PWA regenerados al 80% (`scripts/gen-icons.mjs` con sharp); 5 taps en logo no re-piden PIN si hay sesión (`StaffUnlock` verifica `/api/admin/me`).

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
