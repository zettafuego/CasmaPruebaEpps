/**
 * ═══════════════════════════════════════════════════════════════════
 *  RACS / reportes de desviación — Google Apps Script (backend)
 *  Compatible con RACSCASMA (js/app.js + js/config.js)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  CÓMO CREAR UN BACKEND NUEVO (otra hoja + otro Drive):
 *
 *  1) Google Sheets → Nueva hoja (ej. "RACS - Planta 2")
 *     Copia el ID de la URL:
 *     https://docs.google.com/spreadsheets/d/<<<ESTE_ID>>>/edit
 *
 *  2) Google Drive → Nueva carpeta (ej. "RACS Evidencias Planta 2")
 *     Dentro, opcional: subcarpetas "Fotos", "Firmas", "Cierres"
 *     ID de carpeta:
 *     https://drive.google.com/drive/folders/<<<ESTE_ID>>>
 *
 *  3) Extensiones → Apps Script → pega TODO este archivo
 *  4) Completa CONFIG abajo (SPREADSHEET_ID + FOLDER_*)
 *  5) Ejecuta setupHojas() una vez (autorizar permisos)
 *  6) Implementar → Nueva implementación → Aplicación web
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier persona
 *  7) Copia la URL /exec → pégala en js/config.js → SHEETS_URL
 *
 *  ⚠ No reutilices el mismo despliegue si quieres datos y evidencias
 *    en Sheet/Drive distintos: cada app = Sheet + carpetas + Web App.
 * ═══════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — editar por cada app nueva
// ═════════════════════════════════════════════════════════════════
//
//  TODA evidencia (foto hallazgo, foto entrega, foto cierre, firma) se guarda como
//  archivo real en Google Drive. En el Sheet solo quedan enlaces.
//
//  Opción A — Una carpeta raíz (recomendado): el script crea subcarpetas
//    FOLDER_ROOT = 'id_de_carpeta_padre'
//    (crea: 01_Fotos_Hallazgo / 02_Firmas / 03_Fotos_Cierre / 04_Fotos_Entrega)
//
//  Opción B — Carpetas ya creadas a mano:
//    FOLDER_FOTOS / FOLDER_FIRMAS / FOLDER_CIERRES
//
const CONFIG = {
  // Google Sheet de reportes + personal
  // https://docs.google.com/spreadsheets/d/1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA/edit
  SPREADSHEET_ID: '1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA',

  // Carpeta raíz de evidencias en Drive (se crean subcarpetas solas)
  // https://drive.google.com/drive/folders/1mueUnOcl-6H-0hhtC39S5hMsgVzQ6UOd
  FOLDER_ROOT: '1mueUnOcl-6H-0hhtC39S5hMsgVzQ6UOd',

  // Vacías: se usan las subcarpetas dentro de FOLDER_ROOT
  // 01_Fotos_Hallazgo · 02_Firmas · 03_Fotos_Cierre · 04_Fotos_Entrega
  FOLDER_FOTOS:    '',
  FOLDER_FIRMAS:   '',
  FOLDER_CIERRES:  '',
  FOLDER_ENTREGAS: '',

  // Nombres de hojas dentro del spreadsheet
  // gid=1524185369 — pestaña donde se guardan todos los reportes
  HOJA_REPORTES: 'Reportes',
  HOJA_REPORTES_GID: 1524185369,
  HOJA_PERSONAL: 'Personal',

  // Nombre del proyecto (solo logs)
  APP_NAME: 'RACS / Reportes desviación — Casma',
};

// Columnas de la hoja Reportes (orden fijo; el front envía estos campos)
const COLS_REPORTE = [
  'id', 'estado', 'tipo', 'nivelRiesgo', 'categoria', 'causaProbable',
  'descripcion', 'responsable', 'ubicacion',
  'persona', 'dniObservado', 'areaReportado', 'cargoReportado',
  'fecha', 'hora',
  'reportador', 'dniReportador', 'areaReportador', 'cargoReportador',
  'linksFotos', 'linksFotosLevantamiento',
  'medidasAcciones', 'fechaCierre',
  'firmaRegistro', 'firmaEdicion',
  'createdAt', 'updatedAt',
  'linksFotosEntrega',
  'jefeInmediato',
  'cantidadEpps'
];

// ═════════════════════════════════════════════════════════════════
// HTTP
// ═════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'personal') return json_(getPersonal_());
    if (action === 'reportes') return json_(getReportes_());
    return json_({
      ok: true,
      app: CONFIG.APP_NAME,
      mensaje: 'API activa. Use ?action=personal o ?action=reportes',
      spreadsheet: CONFIG.SPREADSHEET_ID,
    });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const type = body.type || body.action || '';

    switch (type) {
      // Toda evidencia → archivo en Google Drive
      case 'foto':
      case 'firma':
      case 'evidencia':
        return json_(guardarArchivoDrive_(body, type === 'firma' ? 'firma' : (body.tipoEvidencia || body.kind || type)));
      case 'reporte':
        return json_(guardarReportes_(body.data || []));
      case 'update':
        return json_(actualizarReporte_(body.id, body.data || {}));
      case 'personal':
        return json_(agregarPersonal_(body.data));
      default:
        return json_({ ok: false, error: 'type desconocido: ' + type });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═════════════════════════════════════════════════════════════════
// SETUP — ejecutar una vez desde el editor de Apps Script
// ═════════════════════════════════════════════════════════════════
function setupHojas() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf('PEGAR') === 0) {
    throw new Error('Configura CONFIG.SPREADSHEET_ID antes de setupHojas()');
  }
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  resolverHojaReportes_(ss);
  crearHoja_(ss, CONFIG.HOJA_PERSONAL, ['dni', 'nombre', 'cargo', 'area']);

  // Validar / crear carpetas de evidencias en Drive
  try {
    var folders = resolverCarpetas_();
    Logger.log('Drive FOTOS    → ' + folders.fotos);
    Logger.log('Drive FIRMAS   → ' + folders.firmas);
    Logger.log('Drive CIERRES  → ' + folders.cierres);
    Logger.log('Drive ENTREGAS → ' + folders.entregas);
  } catch (e) {
    Logger.log('ERROR carpetas Drive: ' + e.message);
  }

  Logger.log('setupHojas listo. Spreadsheet: ' + CONFIG.SPREADSHEET_ID);
  Logger.log('Cada evidencia se guardará como archivo en Google Drive.');
}

function crearHoja_(ss, nombre, headers) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  const last = sh.getLastColumn();
  if (sh.getLastRow() === 0 || last < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    // Asegurar encabezados si la hoja está vacía de datos
    const row1 = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (!row1[0]) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    } else {
      ensureHeaders_(sh, headers);
    }
  }
  return sh;
}

/** Agrega al final las columnas nuevas que aún no existen (no reordena). */
function ensureHeaders_(sh, headers) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1 || sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  var current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  if (!current[0]) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  headers.forEach(function (h) {
    if (current.indexOf(h) < 0) {
      sh.getRange(1, current.length + 1).setValue(h);
      current.push(h);
    }
  });
}

// ═════════════════════════════════════════════════════════════════
// DRIVE — CADA evidencia se guarda como archivo en Google Drive
// ═════════════════════════════════════════════════════════════════
// Tipos de evidencia:
//   hallazgo | foto     → FOLDER_FOTOS
//   entrega             → FOLDER_ENTREGAS (o FOTOS)
//   cierre | levantamiento → FOLDER_CIERRES (o FOTOS)
//   firma               → FOLDER_FIRMAS

/** Resuelve IDs de carpetas; si hay FOLDER_ROOT, crea subcarpetas. */
function resolverCarpetas_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('folders_v2');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* ignore */ }
  }

  var out = {
    fotos: CONFIG.FOLDER_FOTOS,
    firmas: CONFIG.FOLDER_FIRMAS,
    cierres: CONFIG.FOLDER_CIERRES || CONFIG.FOLDER_FOTOS,
    entregas: CONFIG.FOLDER_ENTREGAS || CONFIG.FOLDER_FOTOS
  };

  if (CONFIG.FOLDER_ROOT && String(CONFIG.FOLDER_ROOT).indexOf('PEGAR') !== 0) {
    var root = DriveApp.getFolderById(CONFIG.FOLDER_ROOT);
    out.fotos = ensureSubfolder_(root, '01_Fotos_Hallazgo').getId();
    out.firmas = ensureSubfolder_(root, '02_Firmas').getId();
    out.cierres = ensureSubfolder_(root, '03_Fotos_Cierre').getId();
    out.entregas = ensureSubfolder_(root, '04_Fotos_Entrega').getId();
  }

  try { cache.put('folders_v2', JSON.stringify(out), 21600); } catch (e) { /* ignore */ }
  return out;
}

function ensureSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function folderIdPara_(tipo, nombreArchivo) {
  var folders = resolverCarpetas_();
  var t = String(tipo || '').toLowerCase();
  var n = String(nombreArchivo || '').toLowerCase();

  if (t === 'firma' || n.indexOf('firma') >= 0) return folders.firmas;
  if (
    t === 'entrega' || t === 'entrega_foto' ||
    n.indexOf('entrega') >= 0
  ) {
    return folders.entregas || folders.fotos;
  }
  if (
    t === 'cierre' || t === 'levantamiento' || t === 'cierre_foto' ||
    n.indexOf('levantamiento') >= 0 || n.indexOf('_lev') >= 0 || n.indexOf('cierre') >= 0
  ) {
    return folders.cierres || folders.fotos;
  }
  // hallazgo | foto | evidencia (default)
  return folders.fotos;
}

/**
 * Guarda SIEMPRE el archivo en Google Drive.
 * body: {
 *   nombre, mime, data (base64 sin prefijo data:),
 *   tipoEvidencia?: 'hallazgo'|'entrega'|'cierre'|'firma',
 *   reporteId?: string
 * }
 * Respuesta: { ok, url, id, name, folderId, tipoEvidencia }
 */
function guardarArchivoDrive_(body, tipo) {
  var tipoEvidencia = String(body.tipoEvidencia || body.kind || tipo || 'foto').toLowerCase();
  if (tipoEvidencia === 'evidencia') tipoEvidencia = 'hallazgo';
  if (tipoEvidencia === 'foto') tipoEvidencia = 'hallazgo';

  var nombre = body.nombre || (tipoEvidencia + '_' + Date.now() + '.bin');
  // Prefijo con id de reporte para ordenar en Drive
  if (body.reporteId && String(nombre).indexOf(String(body.reporteId)) < 0) {
    nombre = 'r' + body.reporteId + '_' + nombre;
  }
  var mime = body.mime || 'application/octet-stream';
  var b64 = body.data;
  if (!b64) return { ok: false, error: 'Sin data base64 — no se puede guardar evidencia en Drive' };

  // Si el front mandó data URL completo por error, limpiar
  if (String(b64).indexOf('base64,') >= 0) {
    b64 = String(b64).split('base64,').pop();
  }

  var folderId = folderIdPara_(tipoEvidencia, nombre);
  if (!folderId || String(folderId).indexOf('PEGAR') === 0 || !String(folderId).trim()) {
    return {
      ok: false,
      error: 'Carpeta Drive no configurada para evidencia tipo "' + tipoEvidencia +
        '". Configure FOLDER_ROOT o FOLDER_FOTOS / FOLDER_FIRMAS / FOLDER_CIERRES en Code.gs'
    };
  }

  var folder = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, nombre);
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* unidades compartidas a veces no permiten esto */ }

  var id = file.getId();
  var url = 'https://drive.google.com/open?id=' + id;
  return {
    ok: true,
    url: url,
    id: id,
    name: file.getName(),
    folderId: folderId,
    tipoEvidencia: tipoEvidencia
  };
}

/** Quita base64 del objeto reporte: en Sheet solo enlaces Drive. */
function limpiarEvidenciasEnMemoria_(r) {
  if (!r || typeof r !== 'object') return r;
  // Nunca persistir data:image en la hoja
  if (r.firmaRegistro && String(r.firmaRegistro).indexOf('data:') === 0) r.firmaRegistro = '';
  if (r.firmaEdicion && String(r.firmaEdicion).indexOf('data:') === 0) r.firmaEdicion = '';
  r.fotos = [];
  r.fotosEntrega = [];
  r.fotosLevantamiento = [];
  return r;
}

// ═════════════════════════════════════════════════════════════════
// SHEETS — personal
// ═════════════════════════════════════════════════════════════════
function getPersonal_() {
  const sh = hoja_(CONFIG.HOJA_PERSONAL);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, personal: [] };
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const personal = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row.join('')) continue;
    const o = {};
    headers.forEach(function (h, j) { o[h] = row[j]; });
    // normalizar nombres de campo
    personal.push({
      dni: String(o.dni || o.DNI || '').trim(),
      nombre: String(o.nombre || o.Nombre || '').trim(),
      cargo: String(o.cargo || o.Cargo || '').trim(),
      area: String(o.area || o.Area || o.área || '').trim(),
    });
  }
  return { ok: true, personal: personal };
}

/**
 * Alta o actualización de personal por DNI.
 * Si el DNI ya existe, actualiza nombre/cargo/área.
 * Si no existe, agrega fila nueva.
 */
function agregarPersonal_(data) {
  if (!data) return { ok: false, error: 'Sin data personal' };
  const list = Array.isArray(data) ? data : [data];
  const sh = hoja_(CONFIG.HOJA_PERSONAL);
  // Asegurar encabezados
  if (sh.getLastRow() === 0) {
    sh.appendRow(['dni', 'nombre', 'cargo', 'area']);
  }
  var added = 0;
  var updated = 0;
  list.forEach(function (p) {
    var dni = String(p.dni || '').trim();
    var nombre = String(p.nombre || '').trim();
    var cargo = String(p.cargo || '').trim();
    var area = String(p.area || '').trim();
    if (!dni && !nombre) return;

    var rowIndex = -1;
    if (dni) {
      var last = sh.getLastRow();
      if (last >= 2) {
        var col = sh.getRange(2, 1, last, 1).getValues();
        for (var i = 0; i < col.length; i++) {
          if (String(col[i][0]).trim() === dni) {
            rowIndex = i + 2;
            break;
          }
        }
      }
    }

    if (rowIndex > 0) {
      // Actualizar fila existente (no borrar datos si vienen vacíos)
      var cur = sh.getRange(rowIndex, 1, 1, 4).getValues()[0];
      sh.getRange(rowIndex, 1, 1, 4).setValues([[
        dni || cur[0],
        nombre || cur[1],
        cargo || cur[2],
        area || cur[3]
      ]]);
      updated++;
    } else {
      sh.appendRow([dni, nombre, cargo, area]);
      added++;
    }
  });
  return { ok: true, added: added, updated: updated, count: list.length };
}

// ═════════════════════════════════════════════════════════════════
// SHEETS — reportes
// ═════════════════════════════════════════════════════════════════
function getReportes_() {
  const sh = hoja_(CONFIG.HOJA_REPORTES);
  ensureHeaders_(sh, COLS_REPORTE);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, reportes: [] };
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const reportes = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row.join('')) continue;
    const o = {};
    headers.forEach(function (h, j) {
      let v = row[j];
      // arrays serializados como JSON o separados por |
      if ((h === 'linksFotos' || h === 'linksFotosLevantamiento' || h === 'linksFotosEntrega') && typeof v === 'string' && v) {
        try {
          if (v.charAt(0) === '[') v = JSON.parse(v);
          else v = v.split('|').filter(Boolean);
        } catch (e) {
          v = v.split('|').filter(Boolean);
        }
      }
      o[h] = v;
    });
    o.synced = true;
    reportes.push(o);
  }
  // más recientes primero
  reportes.reverse();
  return { ok: true, reportes: reportes };
}

function guardarReportes_(lista) {
  if (!lista || !lista.length) return { ok: false, error: 'Sin reportes' };
  const sh = hoja_(CONFIG.HOJA_REPORTES);
  ensureHeaders_(sh, COLS_REPORTE);
  lista.forEach(function (r) {
    limpiarEvidenciasEnMemoria_(r);
    // si ya existe id, actualizar
    const rowIndex = findRowById_(sh, r.id);
    const line = rowFromReporte_(r);
    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, COLS_REPORTE.length).setValues([line]);
    } else {
      sh.appendRow(line);
    }
  });
  return { ok: true, count: lista.length };
}

function actualizarReporte_(id, data) {
  if (!id) return { ok: false, error: 'Sin id' };
  limpiarEvidenciasEnMemoria_(data);
  const sh = hoja_(CONFIG.HOJA_REPORTES);
  ensureHeaders_(sh, COLS_REPORTE);
  const rowIndex = findRowById_(sh, id);
  if (rowIndex < 1) {
    // si no existe, insertar
    data.id = id;
    data.updatedAt = new Date().toISOString();
    sh.appendRow(rowFromReporte_(data));
    return { ok: true, created: true };
  }
  // merge con fila actual
  const headers = COLS_REPORTE;
  const current = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, j) { obj[h] = current[j]; });
  Object.keys(data).forEach(function (k) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') obj[k] = data[k];
  });
  // merge de links de fotos de cierre (ya deben ser URLs de Drive)
  if (data.linksFotosLevantamiento && data.linksFotosLevantamiento.length) {
    var prev = obj.linksFotosLevantamiento;
    if (typeof prev === 'string' && prev) {
      try { prev = JSON.parse(prev); } catch (e) { prev = String(prev).split('|').filter(Boolean); }
    }
    if (!Array.isArray(prev)) prev = [];
    obj.linksFotosLevantamiento = prev.concat(data.linksFotosLevantamiento);
  }
  obj.updatedAt = new Date().toISOString();
  limpiarEvidenciasEnMemoria_(obj);
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([rowFromReporte_(obj)]);
  return { ok: true, updated: true };
}

function rowFromReporte_(r) {
  return COLS_REPORTE.map(function (h) {
    var v = r[h];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return JSON.stringify(v);
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
}

function findRowById_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last, 1).getValues(); // col A = id
  const want = String(id);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === want) return i + 2;
  }
  return -1;
}

function resolverHojaReportes_(ss) {
  var gid = Number(CONFIG.HOJA_REPORTES_GID);
  var sh = null;
  if (gid) {
    if (typeof ss.getSheetById === 'function') {
      try { sh = ss.getSheetById(gid); } catch (e) { sh = null; }
    }
    if (!sh) {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() === gid) {
          sh = sheets[i];
          break;
        }
      }
    }
  }
  if (sh) {
    ensureHeaders_(sh, COLS_REPORTE);
    return sh;
  }
  return crearHoja_(ss, CONFIG.HOJA_REPORTES, COLS_REPORTE);
}

function hoja_(nombre) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (nombre === CONFIG.HOJA_REPORTES) {
    return resolverHojaReportes_(ss);
  }
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = crearHoja_(ss, nombre, ['dni', 'nombre', 'cargo', 'area']);
  }
  return sh;
}
