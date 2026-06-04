# 🚀 Deploy de El Rellenito a Vercel

Guía paso a paso. El proyecto ya está **production-ready**: build verificado, seguridad y privacidad incluidas.

---

## 1. Pre-requisitos
- Cuenta en [vercel.com](https://vercel.com) (el plan **Hobby gratuito** alcanza de sobra).
- El código en un repositorio Git (GitHub / GitLab / Bitbucket).

> El código es propiedad de Gravix Solutions. Usa un repo **privado**.

## 2. Subir el código a GitHub (si aún no está)
```bash
cd "C:\Users\Diomar Guerrero\Claude\claude-webkit\site"
git init
git add .
git commit -m "El Rellenito - listo para deploy"
# crea un repo privado en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/el-rellenito.git
git push -u origin main
```
> ✅ El archivo `.env.local` **NO se sube** (está en `.gitignore`). Las claves secretas las pones directo en Vercel (paso 4).

## 3. Importar en Vercel
1. En Vercel → **Add New… → Project**.
2. Elige el repositorio `el-rellenito`.
3. Vercel detecta **Next.js** solo. **Root Directory:** déjalo en la raíz (donde está `package.json`).
4. **NO hagas deploy todavía** — primero las variables (paso 4).

## 4. Variables de entorno (CRÍTICO)
En la pantalla de import, sección **Environment Variables**, agrega estas (cópialas de tu `.env.local`):

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cbmkqumcsgieivffiody.supabase.co` | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon) | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role) | **SECRETA** |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `584247207067` | pública |
| `ADMIN_PIN` | *(elige uno nuevo de 6 dígitos)* | **SECRETO** |
| `STAFF_PIN` | *(elige uno nuevo de 6 dígitos)* | **SECRETO** |

> ⚠️ **Antes de producción:** cambia `ADMIN_PIN` y `STAFF_PIN` por valores nuevos (los de dev `482079`/`153846` ya se conocen).
> ⚠️ **Rota la `service_role` key** una vez (Supabase → Settings → API → Roll) porque se compartió por chat, y pega el valor nuevo aquí.

## 5. Deploy
Click **Deploy**. En ~2 min tendrás una URL tipo `el-rellenito.vercel.app`. ¡Listo!

## 6. Dominio propio (opcional)
1. Vercel → tu proyecto → **Settings → Domains → Add**.
2. Escribe el dominio (ej. `elrellenito.com`).
3. Vercel te da los registros DNS (un `A` o `CNAME`) para poner en tu registrador. Propaga en minutos/horas.
4. El HTTPS (certificado SSL) es **automático y gratis**.

## 7. Después del deploy — verificación
- [ ] Abre la URL → la web carga con los productos.
- [ ] Haz un pedido de prueba → revísalo en el panel (5 toques al logo → PIN admin).
- [ ] Borra ese pedido de prueba desde Supabase si quieres.
- [ ] Visita `/privacidad` → la política carga.

---

## Seguridad y escala — ya incluido
- **Headers de seguridad** (HSTS, anti-clickjacking, no-sniff, Permissions-Policy) en `next.config.ts`.
- **Panel oculto**: `/admin` redirige a home; solo se entra por gesto secreto + PIN.
- **PINs hasheados** (SHA-256), nunca viajan en claro; bloqueo tras 5 intentos.
- **RLS en Supabase**: los clientes solo pueden crear pedidos, no leerlos. El panel lee con `service_role` solo en el servidor.
- **Rate-limiting** por IP en pedidos y métricas (anti-spam).
- **Cookies/privacidad**: banner de consentimiento + página `/privacidad`.

> Nota sobre rate-limiting: es *best-effort* en memoria. En serverless (Vercel) cada instancia tiene su propia memoria, así que es un freno suave, no un límite global duro. Para el volumen de El Rellenito es suficiente. Si algún día hay abuso real, se migra a Upstash Redis (free tier) — cambio de ~30 min.

## Tasa BCV automática
El endpoint `/api/rates` consulta pydolarve.org cada hora (con fallback a 535.28 Bs/USD si falla). En Vercel funciona sin configuración extra.
