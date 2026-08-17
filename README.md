# Rackcasma epps

Sistema de reportes de seguridad (actos, condiciones y casi accidentes).  
Diseñado **mobile-first** (celular primero).

## Estructura del proyecto

```
RACSCASMA-main/
├── index.html          → Página principal (solo HTML)
├── css/
│   └── styles.css      → Estilos responsive (mobile-first)
├── js/
│   ├── config.js       → ★ Drive, Excel y Google Apps Script
│   └── app.js          → Lógica de la aplicación
└── README.md
```

## ¿Dónde se configura Drive, Excel y App Script?

**Archivo: `js/config.js`**

Ahí está centralizado:

| Qué | Variable | Descripción |
|-----|----------|-------------|
| Google Apps Script | `SHEETS_URL` | URL `/exec` de la Web App |
| Acciones API | `API` | `personal`, `reportes`, etc. |
| Google Drive | `DRIVE` | Thumbnails y previews de fotos/firmas |
| Excel (cliente) | `EXCEL` | CDN de SheetJS, nombre de hoja y archivo |
| Offline | `PENDING_KEY`, etc. | Colas en localStorage |
| App | `APP` | Título y datos de la empresa |

Para cambiar el backend: edita solo `SHEETS_URL` en `js/config.js` y vuelve a desplegar el Apps Script si hace falta.

## Cómo abrir

1. Abre `index.html` en el navegador (o sírvelo con un servidor local).
2. Requiere conexión a internet para sincronizar con Google Sheets/Drive.
3. Sin conexión, los reportes se guardan localmente y se suben al volver online.

## Responsive

- Base pensada para **teléfono** (touch targets ≥ 44px, inputs 16px, safe-area).
- Tablets (~600px) y escritorio (~900px) con ajustes de layout y modales.
