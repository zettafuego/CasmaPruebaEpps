/**
 * ═══════════════════════════════════════════════════════════════════
 *  PLANTILLA — config.js para una NUEVA app (copia y renombra a config.js)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Flujo de guardado:
 *  1) El celular/PC llama a SHEETS_URL (Apps Script Web App).
 *  2) El script escribe filas en un Google Sheet NUEVO (SPREADSHEET_ID).
 *  3) Fotos y firmas (evidencias) se suben a carpetas de Google Drive
 *     DISTINTAS (FOLDER_FOTOS, FOLDER_FIRMAS, etc.) — eso se configura
 *     en el archivo Code.gs del Apps Script, NO aquí.
 *
 *  En este archivo del front solo cambia:
 *  • SHEETS_URL  → URL /exec del NUEVO despliegue
 *  • APP / EXCEL / claves localStorage → para no mezclar apps
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Google Apps Script (Web App) ──────────────────────────────────
// 1. Crea un Google Sheet nuevo
// 2. Extensiones → Apps Script → pega apps-script/Code.gs
// 3. En Code.gs pon SPREADSHEET_ID + IDs de carpetas Drive
// 4. Despliega como Aplicación web → copiar URL que termina en /exec
const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbzNsDm--9xf1w1KV0IL0dMEAmazu9SZvCWeAooYUiQu0w0_HNMMptJJKh-kFRXmVIQ-/exec';
// ↑ Backend actual RACS Casma (Sheet + Drive de evidencias configurados)

// ── Acciones del Apps Script (query ?action=...) ──────────────────
const API = {
  personal: 'personal',   // GET  ?action=personal  → lista de trabajadores
  reportes: 'reportes',   // GET  ?action=reportes  → todos los reportes
};

// ── Google Drive (solo URLs de visualización en el front) ────────
// Las carpetas reales se definen en Code.gs (FOLDER_*).
// Aquí solo se arman links para <img> a partir del fileId devuelto.
const DRIVE = {
  thumb: (fileId, width = 400) =>
    `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
  preview: (fileId) =>
    `https://drive.google.com/file/d/${fileId}/preview`,
  firmaWidth: 300,
  fotoWidth: 400,
};

// ── Exportación Excel local (SheetJS en el navegador) ─────────────
const EXCEL = {
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  sheetName: 'Reportes',
  // Cambia el prefijo por app para no confundir archivos
  filePrefix: 'Reporte_NUEVA_APP_',
};

// ── localStorage — IMPORTANTE: claves distintas por app ───────────
// Si reutilizas las mismas claves, una app pisa la cola offline de la otra.
const PENDING_KEY = 'nueva_app_pending';
const PERSONAL_KEY = 'nueva_app_personal';
const PENDING_UPDATES_KEY = 'nueva_app_pending_updates';

// ── App ───────────────────────────────────────────────────────────
const APP = {
  title: 'Nombre de la nueva app',
  company: 'Compañía Minera Casma SAC',
  ruc: '20606447192',
};

/**
 * CHECKLIST al crear una app nueva
 * ────────────────────────────────
 * [ ] Google Sheet nuevo (vacío o con hojas Personal + Reportes)
 * [ ] Carpeta Drive evidencias/fotos (copiar ID de la URL)
 * [ ] Carpeta Drive firmas (puede ser subcarpeta)
 * [ ] Opcional: carpeta cierres / levantamientos
 * [ ] Pegar IDs en apps-script/Code.gs → ejecutar setupHojas()
 * [ ] Desplegar Web App (Ejecutar como: Yo · Acceso: Cualquiera)
 * [ ] Pegar SHEETS_URL aquí y renombrar este archivo a config.js
 * [ ] Cambiar PENDING_KEY / PERSONAL_KEY para no chocar con RACS
 */
