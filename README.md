# Invitación digital · XV Años de Ashley

Página estática (Diseño "Sello Real") + funciones `/api` en Vercel + Supabase (Postgres).

| Ruta | Quién | Para qué |
|---|---|---|
| `/?i=CODIGO` | Invitado | Ver invitación, confirmar, recibir su QR |
| `/puerta` | Vigilante (PIN) | Escanear QR, ver verde/rojo, búsqueda manual |
| `/panel` | Tú (contraseña) | Alta de invitados, links, estadísticas en vivo, CSV |

## 0. Probar en tu computadora (sin Supabase ni Vercel)
Requiere Node 20+.
```bash
cd invitacion-ashley
npm install
npm run dev            # http://localhost:3000
```
Usa una base **en memoria** con 4 invitados de ejemplo (se pierde al detenerlo):

| Qué | URL | Acceso |
|---|---|---|
| Invitación de Familia Rojas Vega (ya confirmada, con QR) | `http://localhost:3000/?i=FAMROJAS23` | – |
| Invitación pendiente (probar confirmar) | `http://localhost:3000/?i=CARLAMEND2` · `?i=TIOSSAAVE4` | – |
| Vigilante | `http://localhost:3000/puerta` | PIN `1234` |
| Panel | `http://localhost:3000/panel` | contraseña `admin` |

Flujo sugerido: en `/panel` crea un invitado → copia su link → ábrelo en otra pestaña y confirma → guarda/mira el QR → en `/puerta` escanéalo con la cámara (apuntando a la pantalla) o regístralo por búsqueda manual → vuelve al panel y verás el ingreso en vivo.

Notas: la cámara funciona en `localhost`; para probar desde el celular por la red local, el navegador exige HTTPS, así que usa un túnel (por ejemplo `cloudflared tunnel --url http://localhost:3000`). Para probar contra tu Supabase real en local: crea `.env.local` con las variables de la sección 3 y ejecuta `npm run dev:real`.

## 1. Supabase (una vez)
1. Crea un proyecto en supabase.com (plan Free).
2. **SQL Editor → New query**: pega `supabase/schema.sql` y ejecuta.
3. **Project Settings → API**: copia la *Project URL* y la clave **service_role** (secreta: nunca en el HTML ni en git).

## 2. Personalizar
- Edita `public/config.js`: número de Yape, frase, fotos, enlace exacto de Maps (opcional).
- Copia tus archivos a `public/assets/`: `portada.jpg`, `foto1.jpg … foto6.jpg`, `musica.mp3` (MP3 libre de derechos, idealmente < 4 MB).

## 3. Desplegar con la CLI de Vercel
```bash
npm i -g vercel
cd invitacion-ashley
vercel login
vercel link            # crea/enlaza el proyecto (Framework: Other)

# Variables de entorno (cada comando pide el valor; elige Production, y Preview/Development si quieres)
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SESSION_SECRET      # ej: salida de  openssl rand -hex 32
vercel env add ADMIN_PASSWORD      # tu contraseña del panel (larga)
vercel env add GATE_PIN            # PIN del vigilante (ej. 6 dígitos)
vercel env add CRON_SECRET         # ej: openssl rand -hex 16

vercel --prod
```
Si agregas o cambias variables después, vuelve a ejecutar `vercel --prod`.

Prueba local (opcional): `vercel env pull .env.local` y `vercel dev`.

## 4. Usarlo
1. Abre `https://TU-DOMINIO/panel`, entra con `ADMIN_PASSWORD`.
2. Pega tu lista en "Agregar invitados" (`Nombre, cupos` por línea).
3. Por cada invitado usa **WhatsApp** o **Copiar** para enviar su enlace personal.
4. El día del evento, el vigilante abre `https://TU-DOMINIO/puerta` en su celular, ingresa el PIN y permite la cámara.

## Antes del evento (checklist)
- [ ] Probar con 2 celulares: confirmar → guardar QR → escanear en `/puerta` → escanear otra vez (debe salir rojo "YA INGRESÓ").
- [ ] Verificar que la cámara funciona con los datos móviles del vigilante en el local (Castilla, Piura).
- [ ] Exportar el CSV desde el panel el día anterior (plan B en papel) y tener a mano la búsqueda manual.
- [ ] Confirmar que el proyecto de Supabase no esté pausado (el cron diario `/api/keepalive` lo evita; revisa el dashboard igualmente).
- [ ] Cambiar `ADMIN_PASSWORD`/`GATE_PIN` si los compartiste por chat.

## Notas de seguridad
- El navegador nunca habla con Supabase; la tabla tiene RLS activo sin políticas públicas.
- El QR contiene solo un código aleatorio de 10 caracteres; nombre y cupo se leen de la base.
- Ingreso atómico: `UPDATE … WHERE checked_in_at IS NULL`, por lo que un QR no puede validarse dos veces ni con escaneos simultáneos.
- Cualquiera con el enlace personal ve el QR de esa familia: pide que no lo reenvíen.
- Los scripts del escáner y del QR se cargan desde cdnjs; si prefieres, descárgalos a `public/vendor/` y cambia los `<script src>`.

## Pruebas
`npm install && npm test` ejecuta pruebas de la lógica del servidor con una base falsa en memoria.
