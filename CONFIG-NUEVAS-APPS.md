# Análisis y configuración: Sheet nuevo + evidencias en otro Drive

## Regla de evidencias

**Cada evidencia se guarda en Google Drive como archivo:**

| Evidencia | Carpeta Drive | Qué queda en el Sheet |
|-----------|---------------|------------------------|
| Foto hallazgo (EPPS viejos) | `01_Fotos_Hallazgo` | URL / link |
| Firma registro o edición | `02_Firmas` | URL / link |
| Foto entrega (personal / EPPS nuevos) | `04_Fotos_Entrega` | URL / link |

No se guardan imágenes en base64 en la hoja. Si falla la subida a Drive, el reporte **no** se marca como sincronizado y se reintenta.

---

## Qué hace esta app (RACSCASMA / Rackcasma EPPS)

```
Celular / PC (index.html + app.js)
        │
        │  POST / GET  →  SHEETS_URL  (Google Apps Script Web App)
        ▼
   Apps Script (Code.gs)
        ├── escribe filas  →  Google Sheet  (reportes + personal)
        └── sube archivos  →  Google Drive  (fotos, firmas, cierres)
```

| Pieza | Dónde se configura | Qué guarda |
|--------|-------------------|------------|
| Front `js/config.js` | `SHEETS_URL` | Solo la URL del backend |
| Apps Script `CONFIG` | `SPREADSHEET_ID` | Datos tabulares (reportes) |
| Apps Script `CONFIG` | `FOLDER_ROOT` | Evidencias (hallazgo, firmas, entrega) |
| `localStorage` | `PENDING_KEY`, etc. | Cola offline en el dispositivo |

**Importante:** en el repo original **no venía el Apps Script**. Solo el front con una URL ya desplegada:

```
https://script.google.com/macros/s/AKfycbzpq840hyMduK8TF7SooRQO9MgxRykJvmpqh2x1efFmP6OlhbYoW0GIy7pAErxySCCM/exec
```

Esa URL apunta al Sheet y Drive **actuales**. Para una app nueva (otro sheet + otras carpetas) hay que **desplegar un script nuevo** (o una nueva implementación con otros IDs).

---

## Protocolo que usa `app.js` (no cambiar si copias el front)

### GET
| URL | Respuesta esperada |
|-----|--------------------|
| `?action=personal` | `{ ok: true, personal: [{ dni, nombre, cargo, area }] }` |
| `?action=reportes` | `{ ok: true, reportes: [ {...campos del reporte} ] }` |

### POST (`Content-Type: text/plain`, body JSON)
| `type` | Body | Efecto |
|--------|------|--------|
| `foto` | `{ type, nombre, mime, data }` | Sube a Drive → `{ ok, url }` |
| `firma` | igual | Sube firma a Drive → `{ ok, url }` |
| `reporte` | `{ type:'reporte', data: [reporte, ...] }` | Nueva fila en Sheet |
| `update` | `{ type:'update', id, data }` | Actualiza fila (cierre / edición) |
| `personal` | `{ type:'personal', data }` | Agrega personal |

Orden al sincronizar un reporte nuevo:
1. Subir cada foto hallazgo (`type:foto`) → links  
2. Subir firma registro (`type:firma`) → link  
3. Subir fotos cierre si hay  
4. POST `type:reporte` con el objeto (ya con URLs de Drive, sin base64)

---

## Cómo montar una app NUEVA (Sheet + Drive nuevos)

### A) En Google Drive
1. Crea carpeta padre, ej. `CASMA / Apps / MiApp-Evidencias`
2. El script crea solo: `01_Fotos_Hallazgo`, `02_Firmas`, `04_Fotos_Entrega`
3. Copia el **ID** de la carpeta padre (barra de la URL después de `/folders/`) → `FOLDER_ROOT`

### B) En Google Sheets
1. Nueva hoja, ej. `CASMA - Reportes MiApp`
2. Copia el **ID** del spreadsheet (entre `/d/` y `/edit`)
3. Puedes dejarla vacía: el script crea hojas `Reportes` y `Personal` con `setupHojas()`

### C) Apps Script
1. Abre el Sheet → **Extensiones → Apps Script**
2. Pega `apps-script/Code.gs`
3. Completa:

```javascript
const CONFIG = {
  SPREADSHEET_ID: '1abc....',  // tu sheet NUEVO
  FOLDER_ROOT:    '1xyz....',  // carpeta Drive (crea 01_Fotos_Hallazgo, 02_Firmas, 04_Fotos_Entrega)
  ...
};
```

4. Ejecuta **`setupHojas`** (autorizar cuenta Google)
5. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
6. Copia la URL que termina en `/exec`

### D) Front de la app
1. Copia el proyecto (o solo cambia config)
2. Usa `js/config.NUEVA-APP.ejemplo.js` como base → renómbralo a `config.js`
3. Pega la URL nueva en `SHEETS_URL`
4. **Cambia** las claves de `localStorage` (`PENDING_KEY`, etc.) para no mezclar colas offline con RACS

---

## Ejemplo de IDs (rellena los tuyos)

| Recurso | Dónde se ve | Variable |
|---------|-------------|----------|
| Sheet | `docs.google.com/spreadsheets/d/**ID**/edit` | `SPREADSHEET_ID` |
| Carpeta Drive | `drive.google.com/drive/folders/**ID**` | `FOLDER_ROOT` |
| Web App | `script.google.com/macros/s/**…**/exec` | `SHEETS_URL` (front) |

Plantilla rápida:

```
APP: .....................
SHEETS_URL: ..............
SPREADSHEET_ID: ..........
FOLDER_ROOT: .............
PENDING_KEY: .............
```

---

## Recomendaciones

1. **Una app = un Sheet + sus carpetas + un despliegue Web App.**  
   No compartas el mismo `SHEETS_URL` entre apps si quieres datos separados.

2. **Evidencias en otro Drive / Shared Drive:**  
   La cuenta que despliega el script debe tener permiso de **editor** en esas carpetas. Si usas unidad compartida, agrega esa cuenta como miembro.

3. **No pongas IDs de carpetas en el front** (está bien como está): el front solo manda base64; el script decide la carpeta. Así no se filtran IDs y puedes reorganizar Drive sin tocar el celular.

4. **Personal:** llena la hoja `Personal` (columnas `dni`, `nombre`, `cargo`, `area`) o reutiliza una hoja de personal y apúntala en el mismo spreadsheet.

5. **Si solo cambias carpetas de evidencias** pero quieres el **mismo** historial de reportes: deja el mismo `SPREADSHEET_ID` y cambia solo `FOLDER_ROOT`, luego **Nueva versión** del despliegue web (misma URL o nueva según elijas).

6. **Si quieres Sheet y Drive nuevos sin tocar la app vieja:** despliegue **nuevo** + `SHEETS_URL` nueva en un `config.js` de la app nueva.

---

## Archivos generados en este proyecto

| Archivo | Uso |
|---------|-----|
| `apps-script/Code.gs` | Backend listo para pegar en Apps Script |
| `js/config.NUEVA-APP.ejemplo.js` | Plantilla de `config.js` para una app nueva |
| `CONFIG-NUEVAS-APPS.md` | Esta guía |

La app actual sigue usando `js/config.js` (URL del RACS en producción). No la sobrescribas hasta tener el nuevo despliegue probado.
