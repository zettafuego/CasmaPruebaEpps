# Desplegar backend (Sheet + Drive ya configurados)

## IDs ya puestos en `apps-script/Code.gs`

| Recurso | ID / enlace |
|---------|-------------|
| **Google Sheet** | `1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA` |
| | https://docs.google.com/spreadsheets/d/1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA/edit |
| **Drive evidencias** | `1mueUnOcl-6H-0hhtC39S5hMsgVzQ6UOd` |
| | https://drive.google.com/drive/folders/1mueUnOcl-6H-0hhtC39S5hMsgVzQ6UOd |

Al sincronizar, el script creará dentro de la carpeta Drive:

- `01_Fotos_Hallazgo`
- `02_Firmas`
- `03_Fotos_Cierre`

En el Sheet creará (si no existen) las pestañas **Reportes** y **Personal**.

---

## Pasos (una sola vez)

### 1. Abrir el Sheet y el script
1. Abre el [Sheet](https://docs.google.com/spreadsheets/d/1zDNo5CywCZ5_0DM0R1qfn0q3X50-hhH9TdbLt0GbLZA/edit).
2. Menú **Extensiones → Apps Script**.
3. Borra el código por defecto y pega **todo** el contenido de  
   `apps-script/Code.gs`  
   (ya tiene los IDs del Sheet y del Drive).
4. Guarda el proyecto (nombre ej. `RACS-Casma-Backend`).

### 2. Autorizar y preparar hojas
1. En el editor, elige la función **`setupHojas`**.
2. Pulsa **Ejecutar**.
3. Autoriza con la cuenta de Google que tenga **editor** en el Sheet y en la carpeta Drive.
4. Revisa el log: debe decir carpetas OK y “setupHojas listo”.
5. En Drive deberían aparecer las 3 subcarpetas de evidencias.
6. En el Sheet: pestañas **Reportes** y **Personal**.

### 3. Desplegar como aplicación web
1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Descripción: `RACS Casma v1`.
4. Ejecutar como: **Yo**.
5. Quién tiene acceso: **Cualquier persona**.
6. **Implementar** → copiar la URL que termina en **`/exec`**.

### 4. URL en el front — ya configurada
```javascript
const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbw3KhMxURZvd5q4GcyV3HcJ0MI_Hx08GV7dZBKS65-LZnag83ZRGUSyP0431pYOKZ1r/exec';
```
Está en `js/config.js`. Solo recarga la app.

### 5. Probar
1. Abre la app (con internet).
2. Crea un reporte con **1 foto** y **firma**.
3. Espera a que diga sincronizado.
4. Revisa:
   - Sheet → fila nueva en **Reportes** (links, no imágenes enormes).
   - Drive → archivo en `01_Fotos_Hallazgo` y firma en `02_Firmas`.

---

## Personal (DNI de trabajadores)

En la pestaña **Personal** del Sheet, llena columnas:

| dni | nombre | cargo | area |
|-----|--------|-------|------|
| 12345678 | Juan Pérez | Operador | Mina |

La app carga esa lista con `?action=personal`.

---

## Si cambias algo en Code.gs después

**Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar.**  
La URL `/exec` suele mantenerse igual.
