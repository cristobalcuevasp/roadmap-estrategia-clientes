# Roadmap · Estrategia de Clientes

Aplicación web para que el equipo de Estrategia de Clientes gestione tareas, prioridades, rompelíneas y tareas recurrentes en un solo lugar, con cambios visibles al instante para todos.

- **Frontend:** React 18 + Vite + Tailwind CSS 3 (carpeta `src/`), publicado en **GitHub Pages**.
- **Backend:** **Supabase** (Postgres + Auth + Realtime). Proyecto `lcahshmjefleteauhmkx` (región São Paulo).
- **Seguridad:** inicio de sesión con correo y contraseña; cada tabla tiene RLS, así que solo los integrantes del equipo ven o modifican datos.

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
- `supabase/seed/` (la minuta cargada inicialmente) está en `.gitignore` porque contiene contenido interno y correos de terceros. Si algún día necesitas recrear la base, ejecuta primero `supabase/migrations/0001_schema.sql` y luego ese archivo en el *SQL Editor* de Supabase.

## Hosting alternativo

GitHub Pages desde un repositorio **privado** requiere un plan de pago de GitHub. Si prefieres mantenerlo privado sin costo, Netlify, Vercel o Cloudflare Pages aceptan repositorios privados: comando de compilación `npm run build`, carpeta de salida `dist`.

## Limitaciones conocidas

- Plan gratuito de Supabase: el proyecto se **pausa tras 7 días sin actividad** (se reactiva desde el panel) y **no incluye respaldos automáticos**. Con uso diario del equipo no debería pausarse; considera exportar los datos de vez en cuando o pasar al plan Pro.
- Si alguien olvida su contraseña no hay recuperación por correo (por el mismo motivo del paso 3). Si sigue conectada puede cambiarla desde el menú de su avatar; si no, elimina su usuario en *Authentication → Users* (en el panel de Supabase) y pídele que se registre de nuevo con el mismo correo: su ficha y sus tareas se mantienen y se vinculan solas.
- Aún no incluye: tabla propia de proyectos, vista calendario, edición masiva, exportación a Excel ni alertas automáticas de vencimiento.
