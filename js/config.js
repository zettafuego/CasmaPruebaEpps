/**
 * ═══════════════════════════════════════════════════════════════════
 *  RACKCASMA EPPS — CONFIGURACIÓN CENTRAL
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Aquí se guarda TODO lo relacionado con:
 *  • Google Apps Script (backend que escribe en Excel/Sheets)
 *  • Google Drive (fotos y firmas)
 *  • Exportación Excel (cliente)
 *  • Claves de almacenamiento local
 *
 *  Edita este archivo cuando cambies la URL del script, carpetas
 *  de Drive o el nombre del archivo Excel exportado.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Google Apps Script (Web App) ──────────────────────────────────
// Backend: apps-script/Code.gs
//   Sheet:  1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA
//   Drive:  1mueUnOcl-6H-0hhtC39S5hMsgVzQ6UOd  (evidencias)
//   Web App (esta URL):
const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbxLjBh7Zz1w7eBbwOGnY8d7nxxCkL3lkbzey9pfdxRORrvsfaK7qBsb1xwBb4fAT8U/exec';

// ── Acciones del Apps Script (query ?action=...) ──────────────────
const API = {
  personal: 'personal',   // GET  ?action=personal  → lista de trabajadores
  reportes: 'reportes',   // GET  ?action=reportes  → todos los reportes
  // POST body: { action: 'save' | 'update' | ... } según tu script
};

// ── Google Drive (evidencias) ─────────────────────────────────────
// REGLA: cada foto y cada firma se sube como ARCHIVO a Google Drive
// (vía Apps Script). En el Sheet solo se guardan los enlaces.
// Carpetas reales: FOLDER_ROOT o FOLDER_FOTOS / FIRMAS / CIERRES en Code.gs
// El front solo convierte links de Drive a URLs que el <img> puede mostrar.
const DRIVE = {
  // Vista previa / thumbnail de un archivo por ID
  thumb: (fileId, width = 400) =>
    `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
  // Preview embebible (iframe / img fallback)
  preview: (fileId) =>
    `https://drive.google.com/file/d/${fileId}/preview`,
  // Ancho por defecto para firmas en PDF
  firmaWidth: 300,
  // Ancho por defecto para fotos en modal
  fotoWidth: 400,
};

// ── Exportación Excel (cliente, librería SheetJS) ─────────────────
const EXCEL = {
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  sheetName: 'Cambio de EPPS',
  // Nombre del archivo descargado (se le agrega la fecha)
  filePrefix: 'Cambio_de_EPPS_',
};

// ── localStorage (colas offline, no es Drive/Excel) ───────────────
const PENDING_KEY = 'seguridad_pending';
const PERSONAL_KEY = 'seguridad_personal';
const PENDING_UPDATES_KEY = 'seguridad_pending_updates';

// ── App ───────────────────────────────────────────────────────────
const APP = {
  title: 'Minera Casma · Cambio de EPPS',
  subtitle: 'Vales de almacén · EPPS entregados',
  tagline: 'Cada reporte es inmediato',
  company: 'Compañía Minera Casma SAC',
  ruc: '20606447192',
  logo: 'cita_minera_casma_sac-removebg-preview.png',
};
