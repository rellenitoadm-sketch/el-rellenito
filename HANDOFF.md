# HANDOFF — El Rellenito (sesión → nueva sesión)

> Fecha: 2026-06-07 · Estado: **build verde, typecheck limpio, todo verificado en vivo**

---

## 0. Lo PRIMERO que debes saber (rutas)

- **CÓDIGO REAL del proyecto:** `C:\Users\Diomar Guerrero\Claude\claude-webkit\site`
  - Stack: **Next.js 16.2.6** (Turbopack) + **Supabase** + Tailwind v4 + framer-motion. App mobile-first (`.app-shell` max-width 480px).
- **Carpeta de sesión / launch:** `C:\Users\Diomar Guerrero\Claude\El rellenito` → solo tiene `.claude/` (config). Su `launch.json` apunta al site real; el preview se llama **`rellenito`**.
- **NO confundir:** la carpeta "El rellenito" NO tiene código; todo está en `claude-webkit\site`.

### Entorno Windows — gotchas
- **ExecutionPolicy bloquea `.ps1`** → llamar binarios directo: `& "C:\Program Files\nodejs\npm.cmd"`, `npx.cmd`, `& "C:\Program Files\nodejs\node.exe"`. Para `irm | iex` usar `npx.cmd` o `-OutFile` + `powershell -ExecutionPolicy Bypass -File`.
- **Levantar la app:** preview MCP `preview_start` name `"rellenito"` (puerto 3000). Next recompila en el primer request (~10-20s); esperar con poll a `http://localhost:3000` antes de screenshot.
- **Build:** `npm.cmd run build` (verde, ~40s). **Typecheck:** `.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`. 
- **Lint:** `.\node_modules\.bin\eslint.cmd` desde la raíz (necesita `Push-Location`). ⚠️ **Next 16 NO corre ESLint en el build** (solo TypeScript) → los errores `react-hooks/set-state-in-effect` son **pre-existentes repo-wide** (patrón `useEffect(()=>{load()},[])` en todos los paneles) y **NO rompen el deploy**.

### Acceso admin
- **PIN:** `150101` · rol `admin`.
- Entrar: gesto secreto = **5 taps en el logo del TopBar** (dispara evento `staff-unlock` → pinpad). En vivo se puede `POST /api/admin/login {pin:"150101"}` y navegar a `/admin/dashboard`.

---

## 1. Qué se hizo esta sesión (todo verificado en vivo)

### A. Skill `ui-ux-pro-max` — ACTIVADA
- Faltaba el `SKILL.md` en `~/.claude/skills/ui-ux-pro-max/` (solo estaban data/scripts/templates). Se creó → skill activa. Es la que guía las decisiones UI/UX (67 estilos, 161 paletas, reglas UX). Scripts en `scripts/search.py` (Python 3.14 ✓).

### B. Auditoría + fixes UX storefront (cliente)
Componentes en `src/components/`:
- **ProductCard.tsx** — touch targets +/−/Agregar a **44px**; stagger capeado `Math.min(index,8)*0.03`.
- **Cart.tsx** — touch targets 44px; **tecla Escape** cierra; `role="dialog" aria-modal aria-label="Tu pedido"`.
- **Checkout.tsx** — `autoComplete` name/tel + `inputMode`; **focus al primer campo con error** tras submit; CTA ya no muta texto ambiguo (helper text aparte); `data-error` en ProofUpload.
- **WholesalePage.tsx** — touch targets catálogo/back a 44px; `aria-label` que faltaban; inputs `type=tel`/`autoComplete`.

### C. Caveman — INSTALADO y activo
- Hooks `SessionStart`/`UserPromptSubmit` + statusline + MCP `caveman-shrink` en `~/.claude/settings.json`.
- ⚠️ Durante el proceso el usuario **rompió `settings.json`** (pegó un comando dentro del archivo / faltaba `}`). Se reparó y se reinstaló con `--force`. **JSON válido ahora.**
- Comandos disponibles (sesión nueva): `/caveman full|lite|ultra`, `/caveman-commit`, `/caveman-review`, `/caveman-stats`.

### D. Panel Admin — alertas de pedidos (3 alta prioridad + notificación al celular)
En **`src/components/admin/OrdersPanel.tsx`**:
- **Polling 25s** silencioso (sin spinner) que detecta pedidos `pendiente` nuevos.
- **Sonido** (doble beep Web Audio, sin archivo) + **Notification del sistema** (notificación al celular) al entrar pedido nuevo.
- Toggle **🔔 campana** + banner "Activar alertas…" (sirve de gesto para habilitar audio + permiso). Persiste en `localStorage('rl_admin_alerts')`.
- **Confirmar antes de cancelar** (acción destructiva).
- **Toast de error** (`role=alert`) cuando falla un cambio de estado (antes era silencioso).
- Verificado en vivo: toggle on/off, persistencia, banner. (En el navegador de preview `Notification.permission='denied'` — en celular real se concede.)

### E. PWA — instalable + botón de instalar (para clientes)
- **Iconos generados** con sharp: `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (script reutilizable en **`scripts/gen-icons.cjs`**, corre con `node scripts/gen-icons.cjs`). El manifest los referenciaba pero no existían.
- **`src/app/layout.tsx`** — metadata `manifest`, `appleWebApp`, `icons` (quitado el `<link>` manual del head).
- **`public/sw.js`** (NUEVO) — service worker mínimo network-first (instalable + offline básico, sin caché agresiva).
- **`src/components/InstallPrompt.tsx`** (NUEVO) — banner "Instala El Rellenito" con botón **Instalar** (Android/`beforeinstallprompt`) + instrucciones iOS (Compartir→Agregar a inicio); registra el SW; dismissible (`localStorage('rl_install_dismissed')`). Añadido a `src/app/page.tsx`.
- Verificado en vivo: banner aparece, botón 44px, SW **registrado**, meta tags presentes, `secureContext`.
- **Notificación "solo app instalada":** las alertas admin son opt-in; al ser instalable, el staff usa la app en standalone y recibe las notificaciones.

### F. Pendientes acumulados — HECHOS
- **Contraste:** `--text-3` `#8A857F` → **`#6B6760`** en `src/app/globals.css` (ahora AA 4.5:1; verificado `#6b6760` en vivo).
- **Touch targets admin 44px:** sub-vistas, campana, refresh, botones de estado (OrdersPanel), chips (ProductsPanel), link WhatsApp (CrmPanel), refresh (Metrics).
- **Escape en modales admin:** visor de comprobante (OrdersPanel) + **ProductEditor.tsx**, con `role="dialog"`.
- **Gráficos accesibles:** `MetricsPanel.tsx` `HourChart` ahora `role="img"` + `aria-label` con resumen (hora pico + total).

### G. 🐛 Bug encontrado y CORREGIDO — hidratación
- Los fixes iniciales de reduced-motion (`initial={reduce ? false : {...}}` con `useReducedMotion`) **rompían la hidratación** (server vs cliente con reduced-motion) → era el "1 Issue" del overlay de dev.
- **Solución:** se revirtió el branching manual en ProductCard/Cart/Checkout (a `initial` estáticos) y se añadió **`<MotionConfig reducedMotion="user">`** envolviendo la tienda en `src/app/page.tsx`. Hydration-safe + reduced-motion global. Verificado: error desaparecido.

---

## 2. Archivos tocados (en `claude-webkit\site`)

```
src/app/layout.tsx          metadata PWA (manifest/appleWebApp/icons)
src/app/page.tsx            + InstallPrompt, + <MotionConfig reducedMotion="user">
src/app/globals.css         --text-3 #6B6760 (contraste AA)
src/components/ProductCard.tsx       touch 44px, stagger cap, reduced-motion revert
src/components/Cart.tsx              touch 44px, Escape, role=dialog, revert
src/components/Checkout.tsx          autoComplete, focus-error, CTA, revert
src/components/WholesalePage.tsx     touch 44px, aria, input types
src/components/InstallPrompt.tsx     NUEVO — banner instalar PWA + registra SW
src/components/admin/OrdersPanel.tsx alertas (polling+sonido+notif), confirm cancel, toast, touch 44, Escape lightbox
src/components/admin/ProductEditor.tsx  Escape + role=dialog
src/components/admin/ProductsPanel.tsx  chips 44px, refresh 44px
src/components/admin/CrmPanel.tsx       whatsapp link 44px, refresh 44px
src/components/admin/MetricsPanel.tsx   HourChart accesible, refresh 44px
public/sw.js                NUEVO — service worker
public/icon-192.png / icon-512.png / apple-touch-icon.png   NUEVOS
scripts/gen-icons.cjs       NUEVO — genera iconos con sharp
```
Fuera del repo: `~/.claude/skills/ui-ux-pro-max/SKILL.md` (creado), `~/.claude/settings.json` (reparado + caveman).

---

## 3. PENDIENTE (próxima sesión)

### Código
- [ ] **Emojis → SVG en headings de categoría** (ProductList + WholesalePage + ProductsPanel/Metrics usan `categoryEmoji`). Es lo único de las auditorías sin hacer: requiere **decidir un set de iconos** para las ~7 categorías (Tequeños, Pasapalos, Masas, Panadería, Cafetín…). Lucide o iconos custom. No hacerlo a medias.
- [ ] (Opcional) Header: ya cubierto por MotionConfig; sin acción.

### Instalación de herramientas (requieren acción del usuario — bloqueadas para el agente)
- [ ] **MemPalace (MCP server)** — el usuario debe correr:
  ```powershell
  python -m pip install mempalace        # (o pipx install mempalace)
  claude mcp add -s user mempalace -- mempalace-mcp
  ```
  Comando MCP = **`mempalace-mcp`** (entry point oficial). Python 3.14 ✓ compatible (wheels cp314, usa ONNX no torch). Bloqueado para el agente por riesgo de cadena de suministro (nombre de paquete deducido). Guarda historial verbatim local; usa `<private>` para excluir.
- [ ] **claude-mem (thedotmack)** — es un **plugin**, se instala con `/plugin marketplace add thedotmack/claude-mem` + `/plugin install claude-mem`. ⚠️ **`/plugin` NO está disponible en este entorno** (Cowork/embebido). Prereq **Bun ya instalado (1.3.14)**. Pendiente vía CLI alterna o entorno con `/plugin`.

---

## 4. Estado de verificación (al cierre)
- ✅ `npm run build` → **BUILD_EXIT=0** (verde)
- ✅ `tsc --noEmit` → limpio
- ✅ PWA: manifest + iconos (200) + SW registrado + meta iOS + secureContext
- ✅ Storefront y admin probados en vivo (preview MCP)
- ✅ Hydration error resuelto ("1 Issue" desaparecido)
- ⚠️ Dev server detenido tras el build final — relanzar con preview `rellenito` si se necesita.

## 5. Cómo retomar rápido
1. `preview_start` name `rellenito` → esperar a `http://localhost:3000`.
2. Admin: `POST /api/admin/login {pin:"150101"}` → `/admin/dashboard`.
3. Antes de tocar UI: usar skill `ui-ux-pro-max`. Para commits/brevedad: caveman (`/caveman-commit`).
4. Verificar siempre: `tsc --noEmit` + `npm run build` antes de dar por cerrado.
