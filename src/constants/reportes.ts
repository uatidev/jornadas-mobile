/** Roles con acceso al módulo de Reportes. */
export const REPORTS_ROLES = ["super_admin", "secretaria"];

/**
 * Secciones del módulo de Reportes. La vista y el PDF usan los mismos títulos y
 * límites para que el PDF muestre exactamente la información de la pantalla.
 */
export const REPORT_SECTIONS = {
  summary: {
    title: "Solicitudes en total",
    hints: {
      regular: "Del catálogo, sin importar quién los capturó",
      secretary: "Registradas desde el formulario de Secretaría",
    },
  },
  type: {
    title: "Tipo de solicitud",
    subtitle: "Proporción entre trámites y Atención de Secretaría.",
  },
  status: { title: "Por estatus", subtitle: "Desglose por tipo.", limit: 14 },
  services: { title: "Trámites más solicitados", subtitle: "Solo trámites del catálogo.", limit: 8 },
  capturistas: {
    title: "Quién captura",
    subtitle: "Incluye al personal de Secretaría. El color indica el tipo de solicitud, no el rol de quien capturó.",
    limit: 10,
  },
} as const;
