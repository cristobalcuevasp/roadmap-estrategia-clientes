# Roadmap · Estrategia de Clientes

Aplicación web para que el equipo de Estrategia de Clientes gestione tareas, prioridades, rompelíneas y tareas recurrentes en un solo lugar, con cambios visibles al instante para todos.

- **Frontend:** React 18 + Vite + Tailwind CSS 3 (carpeta `src/`), publicado en **GitHub Pages**.
- **Backend:** **Supabase** (Postgres + Auth + Realtime). Proyecto `lcahshmjefleteauhmkx` (región São Paulo).
- **Seguridad:** inicio de sesión con correo y contraseña; cada tabla tiene RLS, así que solo los integrantes del equipo ven o modifican datos.
- **Módulo PROGRAMACIÓN CRM** (calendario de mailings de Preunic, con clima, feriados y días de pago): ver la sección [Programación CRM](#programación-crm).

## Cómo funciona

```
Navegador (cada integrante)  ⇄  Supabase
  React en GitHub Pages          · Auth: inicio de sesión
                                 · Postgres: tareas, comentarios, historial, notificaciones
                                 · Realtime: empuja cada cambio a todos los conectados
```

La base de datos hace el trabajo importante, para que nadie pueda saltarse las reglas desde el navegador:

| Qué | Dónde |
| --- | --- |
| Número de tarea `EST-n` | secuencia en Postgres |
| Historial de cambios (título, prioridad, estado, responsable, fecha, avance, tipo) | trigger `tasks_history` |
| Notificaciones (asignación, P0, cambio de prioridad, bloqueo, rompelínea, menciones `@nombre`) | triggers `tasks_notify` y `comments_notify` |
| Tarea recurrente: al terminarla se crea la siguiente | trigger `tasks_recurring` |
| Fecha de término y 100 % de avance al pasar a «Terminada» | trigger `tasks_before_write` |
| Quién puede registrarse | trigger `on_auth_user_created` |

## Puesta en marcha (una sola vez)

La base de datos ya está creada y cargada con la minuta del equipo. Falta publicar el sitio:

1. **Subir el código a GitHub.** Crea un repositorio vacío y, desde esta carpeta:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
2. **Activar GitHub Pages.** En el repositorio: *Settings → Pages → Build and deployment → Source: **GitHub Actions***. El workflow `.github/workflows/deploy.yml` compila y publica en cada `push` a `main` (tarda ~1 minuto). La dirección queda en `https://TU_USUARIO.github.io/TU_REPO/`.
3. **Ajustes en el panel de Supabase** (*Authentication*):
   - *Sign In / Providers → Email → **Confirm email: desactivar***. El servicio de correo gratuito de Supabase no envía a cualquier dirección, así que con la confirmación activada nadie podría terminar su registro.
   - *URL Configuration → **Site URL***: la dirección de GitHub Pages del paso 2.
4. **Crear la primera cuenta.** Entra al sitio y usa *Crea tu cuenta*. **La primera cuenta que se registre queda como Cristobal Cuevas**, así que hazlo tú antes de compartir el enlace.
5. **Dar acceso al resto.** Menú de tu avatar → *Editar equipo* → escribe el correo de cada integrante. Cuando se registren con ese correo, quedan vinculados a su ficha automáticamente. Un correo que no esté en la lista no puede crear cuenta.

## Programación CRM

Calendario colaborativo (mes y semana) para planificar los mailings de Marketing: varios por día, arrastrar para cambiar de fecha, duplicar, estados configurables (Pendiente / Enviado / otros), filtros por responsable, estado, mailing y región, comentarios semanales con responsable asignado, importar y exportar CSV, indicadores (planificado vs. enviado), detección de choques y carga por responsable. Se abre desde el menú lateral (*Programación CRM*).

**Capas** (se activan y desactivan desde la barra superior): Mailings · Clima · Días de pago · Feriados · Comentarios.

| Tema | Cómo funciona |
| --- | --- |
| Datos | Tablas `crm_*` (migración `0003_crm.sql`), todas con RLS: solo integrantes del equipo. Los mailings, catálogos y comentarios **no se borran** (se cancelan o desactivan). Cada cambio queda en `crm_historial` con autor y fecha. |
| Feriados | Chile 2026 y 2027, **cotejados contra dos medios de prensa, no contra el texto oficial de la ley**. Los regionales cargados quedan «por confirmar». Son editables desde *Configuración → Feriados*; el cálculo de días hábiles se actualiza solo. |
| Días de pago | Reglas editables (último día hábil, primeros hábiles, etc.) que clasifican cada día en alta / media / normal, con justificación visible y ajuste manual por fecha. Son **supuestos de negocio**, no resultados medidos: conviene contrastarlos con las ventas reales. |
| Clima | Probabilidad de precipitación diaria por comuna con tiendas abiertas (66 comunas), promediada por región **ponderando por tiendas abiertas**. Escala de rojos con cortes editables. Región por defecto: Metropolitana. Los primeros días (configurable, 7 por defecto) se rotulan «pronóstico»; después, «tendencia»; más allá del horizonte de la fuente no se muestra nada. Los días pasados muestran el **último pronóstico emitido, no una observación**. La sugerencia de campaña por lluvia es una hipótesis que requiere validación humana. |
| Edición simultánea | Si dos personas editan el mismo mailing, la segunda ve un aviso con «Traer sus cambios» o «Guardar igualmente». |

### Actualización automática del clima

La migración `0004_clima_automatico.sql` programa (pg_cron) dos llamadas diarias, a las 09:30 y 12:30 UTC, a la Edge Function `crm-clima` (`supabase/functions/crm-clima/`). Si la primera del día sale bien, la segunda no hace nada. Cada ejecución queda registrada en `crm_clima_ejecuciones` y se ve en *Configuración → Clima*.

Fuente: **OpenWeather One Call 3.0** (el calendario muestra «Weather data © OpenWeather»). Son ~66 consultas por día; el plan gratuito de One Call permite 1.000 al día, pero **requiere activar la suscripción «One Call by Call» en la cuenta de OpenWeather**.

**Para activarla (una sola vez):**
1. Crear la cuenta en OpenWeather y suscribirse a *One Call by Call* (fijar el límite diario en 1.000 para no pasar al cobro).
2. En Supabase: *Edge Functions → Secrets → Add new secret* con el nombre `OPENWEATHER_API_KEY` y la clave como valor. **La clave no va en este repositorio, ni en el frontend, ni se pega en conversaciones.**
3. Esperar a la siguiente ejecución, o pedir una manual (ver abajo).

Seguridad de la función: se despliega sin verificación de JWT y exige el encabezado `x-cron-secret`, que se compara con un secreto generado dentro de Postgres y guardado en Vault (`crm_clima_cron_secret`). Sin ese secreto responde 401 y no consulta a OpenWeather. Mientras falte la clave, la función solo deja registrado el aviso de que falta.

Ejecución manual (SQL Editor de Supabase): `select private.crm_clima_disparar();` y luego `select * from public.crm_clima_ejecuciones order by inicio desc limit 3;`. Para forzar la actualización aunque hoy ya haya salido bien, llamar a la función con el cuerpo `{"force": true}`.

El pronóstico de cada día se guarda por fecha de consulta (`crm_clima_pronostico`), unas 500 filas diarias (~25 MB al año).

### Correo (pendiente)

Los avisos por correo de los comentarios asignados **no están activos**: requieren que TI verifique un dominio de envío (por ejemplo, en Resend). Mientras tanto, la persona asignada recibe el aviso dentro de la app (campana) y el correo del responsable queda guardado en el comentario.

### Pruebas

```bash
node tests/run.mjs        # lógica del módulo: calendario, días de pago, clima, CSV, análisis, parseo de OpenWeather
```

`supabase/tests/crm_rls_test.sql` es una prueba de base de datos (permisos, historial, avisos, seguridad del clima). Se ejecuta dentro de una transacción que siempre se revierte, así que no deja datos; el informe aparece en el mensaje de error (líneas `OK` / `FALLA`).

Lo que **no** cubren las pruebas automáticas: el clima real de OpenWeather (hasta cargar la clave), el envío de correos, y el uso en un celular real. Se validan a mano.

## Uso diario

- **Board** (inicio), Lista, Mis tareas, Roadmap, Rompelíneas, Weekly Review y Reportes.
- `⌘K` / `Ctrl+K` abre la paleta de comandos; `C` crea una tarea; `/` enfoca la búsqueda.
- Pasa el mouse sobre una tarea para ver su descripción.
- Tema oscuro/claro y menú lateral colapsable se recuerdan en cada navegador.
- Al guardar una tarea solo se envían los campos que cambiaste, así que dos personas pueden editar campos distintos de la misma tarea sin pisarse.

## Desarrollo local

```bash
npm install
cp .env.example .env     # ya trae la URL y la clave pública del proyecto
npm run dev
```

Requiere Node 18 o superior.

## Seguridad

- La URL y la clave `sb_publishable_…` de `.env.production` son **públicas por diseño** (viajan dentro del sitio). El acceso real lo controlan las políticas RLS de `supabase/migrations/0001_schema.sql`.
- **Nunca** pongas la clave `service_role` en este repositorio ni en el frontend.
- `supabase/seed/` (la minuta cargada inicialmente) está en `.gitignore` porque contiene contenido interno y correos de terceros. Si algún día necesitas recrear la base, ejecuta en el *SQL Editor* de Supabase, en este orden, `supabase/migrations/0001_schema.sql`, `0002_keepalive.sql`, `0003_crm.sql`, `0004_clima_automatico.sql` y luego ese archivo.

## Hosting alternativo

GitHub Pages desde un repositorio **privado** requiere un plan de pago de GitHub. Si prefieres mantenerlo privado sin costo, Netlify, Vercel o Cloudflare Pages aceptan repositorios privados: comando de compilación `npm run build`, carpeta de salida `dist`.

## Limitaciones conocidas

- Plan gratuito de Supabase: el proyecto se **pausa tras 7 días sin actividad** (se reactiva desde el panel) y **no incluye respaldos automáticos**. Con uso diario del equipo no debería pausarse, y además el workflow `.github/workflows/keepalive.yml` llama a `public.keepalive()` (función de solo lectura) los lunes y jueves para cubrir semanas sin uso, como las vacaciones. Si ese workflow falla, GitHub avisa por correo (señal de que el proyecto se pausó o cambió algo). Considera exportar los datos de vez en cuando o pasar al plan Pro.
- Si alguien olvida su contraseña no hay recuperación por correo (por el mismo motivo del paso 3). Si sigue conectada puede cambiarla desde el menú de su avatar; si no, elimina su usuario en *Authentication → Users* (en el panel de Supabase) y pídele que se registre de nuevo con el mismo correo: su ficha y sus tareas se mantienen y se vinculan solas.
- Aún no incluye: tabla propia de proyectos, vista calendario del roadmap, edición masiva, exportación a Excel ni alertas automáticas de vencimiento. (La vista calendario de mailings sí existe, en *Programación CRM*.)
