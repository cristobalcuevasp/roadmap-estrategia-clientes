/* Catálogos fijos del módulo Feedback & Desarrollo (los valores coinciden con las restricciones de la base de datos). */

export const TIPOS_SESION = [
  { id: "1a1", label: "Conversación 1:1" },
  { id: "positivo", label: "Feedback positivo" },
  { id: "mejora", label: "Feedback de mejora" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "desarrollo", label: "Desarrollo profesional" },
  { id: "evaluacion", label: "Evaluación" },
];
export const tipoLabel = (id) => TIPOS_SESION.find((t) => t.id === id)?.label || id;

export const MODALIDADES = [
  { id: "presencial", label: "Presencial" },
  { id: "virtual", label: "Virtual" },
];
export const modalidadLabel = (id) => MODALIDADES.find((m) => m.id === id)?.label || id;

/* "vencido" no se guarda: se calcula por fecha (ver estadoEfectivo). */
export const ESTADOS_COMPROMISO = [
  { id: "pendiente", label: "Pendiente", color: "slate" },
  { id: "en_progreso", label: "En progreso", color: "blue" },
  { id: "bloqueado", label: "Bloqueado", color: "orange" },
  { id: "cumplido", label: "Cumplido", color: "emerald" },
  { id: "vencido", label: "Vencido", color: "red" },
  { id: "cancelado", label: "Cancelado", color: "slate" },
];
export const estadoCompromisoMeta = (id) => ESTADOS_COMPROMISO.find((e) => e.id === id) || ESTADOS_COMPROMISO[0];
/* Estados que se pueden elegir al revisar (vencido no se escribe a mano) */
export const ESTADOS_REVISABLES = ESTADOS_COMPROMISO.filter((e) => e.id !== "vencido");

export const ESTADOS_OBJETIVO = [
  { id: "pendiente", label: "Pendiente", color: "slate" },
  { id: "en_curso", label: "En curso", color: "blue" },
  { id: "en_riesgo", label: "En riesgo", color: "orange" },
  { id: "cumplido", label: "Cumplido", color: "emerald" },
  { id: "cancelado", label: "Cancelado", color: "slate" },
];
export const estadoObjetivoMeta = (id) => ESTADOS_OBJETIVO.find((e) => e.id === id) || ESTADOS_OBJETIVO[0];

export const PRIORIDADES = [
  { id: "alta", label: "Alta", color: "red" },
  { id: "media", label: "Media", color: "amber" },
  { id: "baja", label: "Baja", color: "slate" },
];
export const prioridadMeta = (id) => PRIORIDADES.find((p) => p.id === id) || PRIORIDADES[1];

export const ESTADOS_PERSONA = [
  { id: "activo", label: "Activo", color: "emerald" },
  { id: "ausente", label: "Ausente", color: "amber" },
  { id: "inactivo", label: "Inactivo", color: "slate" },
];
export const estadoPersonaMeta = (id) => ESTADOS_PERSONA.find((e) => e.id === id) || ESTADOS_PERSONA[0];

export const CATEGORIAS_SUGERIDAS = ["Desarrollo", "Calidad", "Comunicación", "Liderazgo", "Técnico", "Innovación", "Procesos", "Clientes"];

/* Ejemplos de roles de la especificación: solo se ofrecen como atajo para crearlos, no se cargan solos. */
export const ROLES_EJEMPLO = [
  "Líder Tecnológico", "Vanguardia IA", "Referente de Arquitectura", "Impulsor de Innovación",
  "Mentor Técnico", "Referente de Calidad", "Responsable de Automatización", "Líder de Transformación Digital",
];

/* Umbrales por defecto (el líder los cambia en Configuración; se guardan en fb_config) */
export const CONFIG_DEFECTO = { dias_sin_feedback: 30, dias_aviso_vencimiento: 7, dias_objetivo_sin_actualizar: 30 };

export const SECCIONES_MINUTA = [
  { id: "resumen", titulo: "1. Resumen de la conversación" },
  { id: "positivos", titulo: "2. Aspectos positivos" },
  { id: "mejoras", titulo: "3. Oportunidades de mejora" },
  { id: "decisiones", titulo: "4. Decisiones y acuerdos" },
  { id: "compromisos", titulo: "5. Compromisos adquiridos" },
  { id: "responsables_fechas", titulo: "6. Responsables y fechas" },
  { id: "proximos_pasos", titulo: "7. Próximos pasos" },
];
