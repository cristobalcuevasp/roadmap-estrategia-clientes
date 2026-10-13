# Roadmap · Estrategia de Clientes

Aplicación web para que el equipo de Estrategia de Clientes gestione tareas, prioridades, rompelíneas y tareas recurrentes en un solo lugar, con cambios visibles al instante para todos.

- **Frontend:** React 18 + Vite + Tailwind CSS 3 (carpeta `src/`), publicado en **GitHub Pages**.
- **Backend:** **Supabase** (Postgres + Auth + Realtime). Proyecto `lcahshmjefleteauhmkx` (región São Paulo).
- **Seguridad:** inicio de sesión con correo y contraseña; cada tabla tiene RLS, así que solo los integrantes del equipo ven o modifican datos.
- **Módulo PROGRAMACIÓN CRM** (calendario de mailings de Preunic, con clima, feriados y días de pago): ver la sección [Programación CRM](#programación-crm).
- **Módulo FEEDBACK & DESARROLLO** (fichas individuales, roles, objetivos, feedback con minuta, compromisos y preparación de reuniones): ver la sección [Feedback & Desarrollo](#feedback--desarrollo).

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

Las migraciones `0004_clima_automatico.sql`, `0005_clima_google.sql` y `0006_clima_una_vez_al_dia.sql` programan (pg_cron) **una sola llamada diaria** (tarea `crm-clima`, 09:30 UTC = 06:30 en horario de verano de Chile y 05:30 en invierno) a la Edge Function `crm-clima` (`supabase/functions/crm-clima/`) y una limpieza horaria (`crm-clima-purga`). No hay reintentos automáticos: si un día falla, se ve en *Configuración → Clima* y se puede repetir a mano (ver abajo). Cada ejecución queda registrada en `crm_clima_ejecuciones` y se ve en *Configuración → Clima*.

La función admite **tres proveedores**. Si no existe el secreto `CLIMA_PROVEEDOR`, usa **OpenWeather gratis**; para otro, se elige con ese secreto (`openweather_gratis`, `openweather` o `google`):

| | OpenWeather gratis (predeterminado) | OpenWeather One Call 3.0 | Google Maps Platform Weather API |
|---|---|---|---|
| `CLIMA_PROVEEDOR` | `openweather_gratis` (o sin definir) | `openweather` | `google` |
| Secreto con la clave | `OPENWEATHER_API_KEY` | `OPENWEATHER_API_KEY` (la misma) | `GOOGLE_WEATHER_API_KEY` |
| Consultas | ~66 al día (1 por comuna con tiendas abiertas) | ~66 al día | ~66 al día, unas 2.000 al mes |
| Costo | Plan gratuito de OpenWeather (hasta 1.000.000 de llamadas al mes) | 1.000 consultas diarias gratis, pero exige la suscripción «One Call by Call» | Cuota gratuita mensual de Google (consultar la tarifa vigente); exige proyecto de Google Cloud con facturación activa |
| Horizonte | **5 días** (bloques de 3 horas que se agrupan por día local; se descartan los días con menos de 12 horas cubiertas) | ~8 días | hasta 10 días |
| Probabilidad de lluvia | la **mayor** entre los bloques de 3 horas del día | del día | la **mayor** entre el tramo diurno (07–19 h) y el nocturno (19–07 h) |
| Guardado | se conserva el historial de pronósticos | se conserva el historial de pronósticos | **se borra a las 24 horas** (condición de uso de Google); no hay pronósticos de días pasados |
| Crédito en pantalla | «Weather data © OpenWeather.» | «Weather data © OpenWeather.» | «Source: Includes weather data from Google.» |

El crédito de cada proveedor se muestra solo cuando hay datos suyos en pantalla. Los días más allá del horizonte del proveedor no muestran clima.

**Para activarla (una sola vez), con OpenWeather gratis:**
1. Crear la cuenta en <https://home.openweathermap.org/users/sign_up> (correo y contraseña; confirmar el correo) y copiar la clave de la pestaña *API keys*. Una clave nueva puede tardar un rato (a veces un par de horas) en activarse: mientras tanto OpenWeather responde 401.
2. En Supabase: *Edge Functions → Secrets → Add new secret* con el nombre `OPENWEATHER_API_KEY` y la clave como valor. No hace falta `CLIMA_PROVEEDOR`. **La clave no va en este repositorio, ni en el frontend, ni se pega en conversaciones.**
3. Esperar a la siguiente ejecución, o pedir una manual (ver abajo).

*Para usar Google en su lugar:* crear un proyecto en Google Cloud con facturación, habilitar la **Weather API**, crear una clave y **restringirla a esa API**, fijar una cuota diaria baja para evitar cobros inesperados, y cargar `GOOGLE_WEATHER_API_KEY` y `CLIMA_PROVEEDOR` = `google`. *Para One Call 3.0:* suscribirse a *One Call by Call* (límite diario en 1.000) y cargar `CLIMA_PROVEEDOR` = `openweather`.

Seguridad de la función: se despliega sin verificación de JWT y exige el encabezado `x-cron-secret`, que se compara con un secreto generado dentro de Postgres y guardado en Vault (`crm_clima_cron_secret`). Sin ese secreto responde 401 y no consulta a ningún proveedor. Mientras falte la clave, la función solo deja registrado el aviso de que falta.

Cumplimiento con Google: tras la corrida diaria la función borra el pronóstico de Google anterior, y la tarea `crm-clima-purga` (cada hora) elimina todo pronóstico de Google con más de 23 horas aunque una corrida falle. Como solo hay una actualización al día, cada madrugada queda una ventana de unos 25 minutos (antes de la corrida de las 09:30 UTC) sin pronóstico de Google. Con OpenWeather esa limpieza no toca nada y no hay ventana.

Ejecución manual (SQL Editor de Supabase): `select private.crm_clima_disparar();` y luego `select * from public.crm_clima_ejecuciones order by inicio desc limit 3;`. Si hoy ya salió bien, una llamada manual no consulta de nuevo (responde «omitida»); para forzarla, llamar a la función con el cuerpo `{"force": true}`.

Con OpenWeather, el pronóstico de cada día se guarda por fecha de consulta (`crm_clima_pronostico`), unas 500 filas diarias (~25 MB al año).

### Avisos de comentarios

Los comentarios semanales asignados a alguien con cuenta vinculada generan un aviso **dentro de la app** (campana). El envío de correos quedó **fuera del alcance** por decisión del equipo: la interfaz no pide ni muestra correos de responsables. Las columnas `crm_responsables.email` y `crm_comentarios_semana.correo_responsable` y la tabla `crm_correos` siguen en la base sin uso, por si algún día se retoma.

### Pruebas

```bash
node tests/run.mjs        # lógica de los módulos: calendario, días de pago, clima, CSV, análisis, parseo de OpenWeather y de Google, y Feedback & Desarrollo
```

`supabase/tests/crm_rls_test.sql` y `supabase/tests/fb_rls_test.sql` son pruebas de base de datos (permisos, historial, avisos, seguridad del clima; y en Feedback & Desarrollo, quién ve qué, publicación, versiones y revisiones de compromisos). Se ejecutan dentro de una transacción que siempre se revierte, así que no dejan datos; el informe aparece en el mensaje de error (líneas `OK` / `FALLA`).

Lo que **no** cubren las pruebas automáticas: el clima real de OpenWeather o Google (hasta cargar una clave; las pruebas usan respuestas sintéticas con la forma documentada) y el uso en un celular real. Se validan a mano.

## Feedback & Desarrollo

Menú lateral → grupo **Personas** → *Feedback & Desarrollo* (migración `supabase/migrations/0007_feedback_desarrollo.sql`).

**Quién ve qué.** Las fichas son individuales. Quien es **líder** ve y edita todas las fichas, las notas privadas, los borradores, la auditoría y la configuración. Cada **integrante** ve solo su propia ficha, en modo lectura: sus roles, objetivos, compromisos (con su historial de revisiones) y las minutas **publicadas** con sus versiones. Nunca ve notas privadas, borradores, la auditoría ni las fichas de otras personas. Una cuenta sin ficha ni liderazgo no ve la entrada del módulo. Estas reglas las aplica la base de datos (RLS), no solo la interfaz.

**Definir quién es líder.** Es la tabla `public.fb_lideres`, que guarda el `id` de un miembro del equipo (`team_members.id`); no se escriben correos. La migración deja como líder al miembro `cristobal_cuevas`. Para agregar o quitar a alguien, desde el *SQL Editor* de Supabase:

```sql
insert into public.fb_lideres (member_id) values ('<id del miembro>');
delete from public.fb_lideres where member_id = '<id del miembro>';
```

Una persona queda asociada a su cuenta cuando se registra con el correo cargado en *Editar equipo* (igual que el resto de la app). Mientras no tenga cuenta, solo el líder ve su ficha.

**Qué incluye.**
- **Panel:** indicadores del equipo, gráficos de los últimos 6 meses (reuniones, compromisos y objetivos), alertas (sin feedback reciente, compromisos vencidos o por vencer, objetivos sin actualizar) y próximas reuniones de seguimiento.
- **Ficha:** resumen, roles y expectativas (con historial), objetivos con avance, historial de feedback, compromisos, evolución (línea de tiempo) y, solo para el líder, notas privadas y registro de cambios.
- **Feedback:** formulario en tres pasos (registro de la conversación, compromisos y seguimiento, minuta). La minuta de 7 secciones se arma sola con lo registrado (sin inteligencia artificial) y se puede editar antes de publicar. Al publicar, los compromisos quedan creados y vinculados.
- **Minuta publicada:** no se edita directamente; cada cambio exige un motivo y crea una **versión nueva** (se puede ver qué cambió). Se imprime o guarda como PDF desde el diálogo de impresión del navegador y nunca incluye notas privadas.
- **Compromisos:** estado, avance y vencimiento cambian solo con *Revisar compromiso*, que deja una revisión permanente (nada se borra). «Vencido» se calcula por fecha. Vista de tabla y de tablero (no arrastrable).
- **Preparar feedback:** resumen de lo pendiente antes de la reunión (último feedback, compromisos abiertos, lo cumplido desde entonces, objetivos que requieren atención, temas pendientes) y una agenda editable que se lleva al formulario.
- **Agenda:** seguimientos programados por semana; al publicar una minuta, los seguimientos programados hasta esa fecha pasan a «realizado».
- **Configuración** (solo líder): integrantes y fichas, catálogo de roles y umbrales de las alertas del panel.

**Cumplimiento de compromisos** = cumplidos ÷ (cumplidos + vencidos).

**Aún no incluye** (quedó para una segunda etapa): metas numéricas/KPIs, plan de desarrollo y competencias, alertas automáticas por correo o notificación push, ayuda de inteligencia artificial, archivos adjuntos, políticas de retención y un calendario mensual completo (hay una agenda por semana).

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
- `supabase/seed/` (la minuta cargada inicialmente) está en `.gitignore` porque contiene contenido interno y correos de terceros. Si algún día necesitas recrear la base, ejecuta en el *SQL Editor* de Supabase, en este orden, `supabase/migrations/0001_schema.sql`, `0002_keepalive.sql`, `0003_crm.sql`, `0004_clima_automatico.sql`, `0005_clima_google.sql`, `0006_clima_una_vez_al_dia.sql`, `0007_feedback_desarrollo.sql` y luego ese archivo.

## Hosting alternativo

GitHub Pages desde un repositorio **privado** requiere un plan de pago de GitHub. Si prefieres mantenerlo privado sin costo, Netlify, Vercel o Cloudflare Pages aceptan repositorios privados: comando de compilación `npm run build`, carpeta de salida `dist`.

## Limitaciones conocidas

- Plan gratuito de Supabase: el proyecto se **pausa tras 7 días sin actividad** (se reactiva desde el panel) y **no incluye respaldos automáticos**. Con uso diario del equipo no debería pausarse, y además el workflow `.github/workflows/keepalive.yml` llama a `public.keepalive()` (función de solo lectura) los lunes y jueves para cubrir semanas sin uso, como las vacaciones. Si ese workflow falla, GitHub avisa por correo (señal de que el proyecto se pausó o cambió algo). Considera exportar los datos de vez en cuando o pasar al plan Pro.
- Si alguien olvida su contraseña no hay recuperación por correo (por el mismo motivo del paso 3). Si sigue conectada puede cambiarla desde el menú de su avatar; si no, elimina su usuario en *Authentication → Users* (en el panel de Supabase) y pídele que se registre de nuevo con el mismo correo: su ficha y sus tareas se mantienen y se vinculan solas.
- Aún no incluye: tabla propia de proyectos, vista calendario del roadmap, edición masiva, exportación a Excel ni alertas automáticas de vencimiento. (La vista calendario de mailings sí existe, en *Programación CRM*.)
