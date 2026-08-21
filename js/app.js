
// ── FUENTE DE VERDAD: siempre el servidor ──
// localStorage solo guarda:
//   1. Cola de reportes nuevos pendientes de subir  (PENDING_KEY)
//   2. Cola de updates pendientes                   (PENDING_UPDATES_KEY)
//   3. Lista de personal cacheada                   (PERSONAL_KEY)
// Los reportes confirmados del servidor se guardan en memoria (allReportes)
// y se mezclan con los pendientes locales para mostrar en pantalla.

let allReportes = []; // reportes del servidor (en memoria, se pierden al recargar)
let serverLoaded = false; // true una vez que se cargó del servidor al menos una vez

// Devuelve la vista combinada: remotos + pendientes locales (sin duplicar)
function getReportes(){
  const pending = getPending();
  // Los pendientes son objetos completos guardados en la cola
  const pendingIds = new Set(pending.map(r => String(r.id)));
  // Filtrar allReportes para que los pendientes no aparezcan duplicados
  const remotos = allReportes.filter(r => !pendingIds.has(String(r.id)));
  // Pendientes al inicio (los más recientes, aún no en el server)
  return [...pending, ...remotos];
}

const getPending=()=>{try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');}catch{return[];}};
// savePending ahora guarda objetos completos (no solo IDs)
const savePending=d=>localStorage.setItem(PENDING_KEY,JSON.stringify(d));
const getPendingUpdates=()=>{try{return JSON.parse(localStorage.getItem(PENDING_UPDATES_KEY)||'[]');}catch{return[];}};
const savePendingUpdates=d=>localStorage.setItem(PENDING_UPDATES_KEY,JSON.stringify(d));
const getPersonal=()=>{try{return JSON.parse(localStorage.getItem(PERSONAL_KEY)||'[]');}catch{return[];}};
const savePersonal=d=>localStorage.setItem(PERSONAL_KEY,JSON.stringify(d));

const REPORTANTE_DEFAULT='SSOMA';

let selectedTipo='', selectedRiesgo='', selectedEstado='Cerrado';
const DESC_MIN=80;
let photoDataURLs=[], photoLevDataURLs=[], photoEntregaDataURLs=[];
let filtroRiesgo='', filtroCategoria='', filtroTipo='', filtroEstadoLista='';
let filtroUbicacion='', filtroPersona='';
let editPhotoLevDataURLs=[];
let currentEditId=null;
let introFinalizado=false;
let appInicializada=false;

/**
 * Intro estilo Netflix → luego muestra la app (mobile-first).
 */
function finalizarIntro(){
  if(introFinalizado) return;
  introFinalizado=true;
  const splash=document.getElementById('splash-intro');
  const shell=document.getElementById('app-shell');
  if(splash) splash.classList.add('is-done');
  document.body.classList.remove('splash-on');
  if(shell) shell.hidden=false;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content','#f0f4f8');
  setTimeout(()=>{
    if(splash&&splash.parentNode) splash.remove();
  },600);
  iniciarAppPrincipal();
}

function iniciarAppPrincipal(){
  if(appInicializada) return;
  appInicializada=true;
  const fecha=document.getElementById('fecha');
  const hora=document.getElementById('hora');
  if(fecha) fecha.value=new Date().toISOString().split('T')[0];
  if(hora) hora.value=new Date().toTimeString().slice(0,5);
  actualizarContadorDesc();
  setFiltroEstadoBtnActive();
  initFiltroStats();
  updateSyncUI();
  renderReportes();
  renderSeguimientos();
  renderStats();
  updateLiveStamp();
  startLiveStats();
  cargarPersonal();
  if(navigator.onLine) cargarDelServidor(true);
}

window.addEventListener('load',()=>{
  // Preferencias de movimiento reducido: intro casi instantánea
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay=reduced?350:2800;
  setTimeout(finalizarIntro, delay);
  // Por si el usuario toca "Saltar" (onclick en HTML)
  const skip=document.getElementById('splash-skip');
  if(skip) skip.addEventListener('click', function(e){ e.preventDefault(); finalizarIntro(); });
  // Tap en el splash también puede saltar (móvil)
  const splash=document.getElementById('splash-intro');
  if(splash){
    splash.addEventListener('click', function(e){
      if(e.target.closest('.splash-skip')) return;
      // segundo toque / toque largo no; un toque en el fondo tras 0.8s salta
      if(performance.now()>900) finalizarIntro();
    });
  }
});
window.addEventListener('online',()=>{updateSyncUI();autoSync();refrescarDatosEnVivo();});
window.addEventListener('offline',()=>{updateSyncUI();updateLiveStamp();});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && navigator.onLine) refrescarDatosEnVivo();
});

function showTab(tab){
  ['nuevo','reportes','seguimientos','stats'].forEach(t=>{
    document.getElementById('tab-'+t).style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('.tab').forEach((el,i)=>{
    el.classList.toggle('active',['nuevo','reportes','seguimientos','stats'][i]===tab);
  });
  if(tab==='reportes') renderReportes();
  if(tab==='seguimientos') renderSeguimientos();
  if(tab==='stats'){
    initFiltroStats();
    renderStats();
    if(navigator.onLine) refrescarDatosEnVivo();
  }
}

/* ───── SELECCIÓN DE CHIPS ───── */
function selectEstado(el){
  document.querySelectorAll('#estado-chips .chip').forEach(c=>c.className='chip');
  selectedEstado=el.dataset.value;
  el.className='chip '+(selectedEstado==='Abierto'?'sel-abierto':'sel-cerrado');
  // Toggle sección levantamiento
  document.getElementById('seccionLevantamiento').style.display=selectedEstado==='Cerrado'?'block':'none';
}

function selectTipo(el){
  document.querySelectorAll('#tipo-chips .chip').forEach(c=>c.className='chip');
  selectedTipo=el.dataset.value;
  const m={'Acto Subestándar':'sel-act','Condición Subestándar':'sel-cond','Casi Accidente':'sel-near'};
  el.className='chip '+(m[selectedTipo]||'sel-act');
}

function selectRiesgo(el){
  document.querySelectorAll('#riesgo-chips .chip').forEach(c=>c.className='chip');
  selectedRiesgo=el.dataset.value;
  const m={'Bajo':'sel-bajo','Medio':'sel-medio','Alto':'sel-alto'};
  el.className='chip '+m[selectedRiesgo];
}

/* ───── BÚSQUEDA / ALTA DE PERSONAL ───── */
// Si existe en la lista → autocompleta.
// Si no existe → se pueden escribir los datos y se guardan (local + Sheet).

async function cargarPersonal(){
  if(!navigator.onLine) return;
  try{
    const res=await fetch(SHEETS_URL+'?action=personal');
    if(res.ok){
      const json=await res.json();
      if(json.ok && Array.isArray(json.personal)){
        // Fusionar con altas locales pendientes (no perder creaciones offline)
        const remoto=json.personal.map(normalizarPersona);
        const local=getPersonal();
        const byDni=new Map();
        remoto.forEach(p=>{ if(p.dni) byDni.set(p.dni, p); });
        local.forEach(p=>{
          const n=normalizarPersona(p);
          if(n.dni && !byDni.has(n.dni)) byDni.set(n.dni, n);
        });
        savePersonal([...byDni.values()]);
      }
    }
  }catch(e){console.error('No se pudo cargar personal:', e);}
}

function normalizarPersona(p){
  return {
    dni: String(p?.dni??'').trim(),
    nombre: String(p?.nombre??'').trim(),
    cargo: String(p?.cargo??'').trim(),
    area: String(p?.area??'').trim(),
  };
}

function soloDigitos(s){
  return String(s||'').replace(/\D/g,'');
}

function dniDe(p){
  return soloDigitos(p?.dni);
}

function buscarPersonalPorDni(dni){
  const d=soloDigitos(dni);
  if(!d) return null;
  return getPersonal().find(p=>dniDe(p)===d) || null;
}

/** Coincidencias por prefijo de DNI, exacto primero. */
function buscarPersonalPorDniPrefijo(q, limit=8){
  const d=soloDigitos(q);
  if(!d) return [];
  return getPersonal()
    .filter(p=>dniDe(p).startsWith(d))
    .sort((a,b)=>{
      const da=dniDe(a), db=dniDe(b);
      if(da===d && db!==d) return -1;
      if(db===d && da!==d) return 1;
      return da.localeCompare(db) || (a.nombre||'').localeCompare(b.nombre||'');
    })
    .slice(0, limit);
}

/**
 * Búsqueda de personal: DNI primero, nombre como respaldo.
 * Puntaje: DNI exacto > prefijo DNI > DNI contiene > nombre exacto/prefijo/contiene.
 */
function buscarPersonal(q, limit=8){
  const raw=String(q||'').trim();
  if(!raw) return [];
  const digits=soloDigitos(raw);
  const sl=raw.toLowerCase();
  const scored=getPersonal().map(p=>{
    const dni=dniDe(p);
    const nom=(p.nombre||'').toLowerCase();
    let score=0;
    if(digits && dni){
      if(dni===digits) score=100;
      else if(dni.startsWith(digits)) score=80;
      else if(digits.length>=4 && dni.includes(digits)) score=55;
    }
    if(nom && /[a-záéíóúñ]/i.test(raw)){
      if(nom===sl) score=Math.max(score,40);
      else if(nom.startsWith(sl)) score=Math.max(score,30);
      else if(nom.includes(sl)) score=Math.max(score,20);
    } else if(nom && !digits){
      if(nom===sl) score=Math.max(score,40);
      else if(nom.startsWith(sl)) score=Math.max(score,30);
      else if(nom.includes(sl)) score=Math.max(score,20);
    }
    return {p, score};
  }).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score || (a.p.nombre||'').localeCompare(b.p.nombre||''));
  return scored.slice(0, limit).map(x=>x.p);
}

function buscarPersonalPorNombre(q){
  return buscarPersonal(q);
}

function htmlOpcionPersona(p, i, fn){
  return `<div onclick="${fn}(${i})"
         data-idx="${i}"
         style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;"
         onmouseover="this.style.background='var(--surface2)'"
         onmouseout="this.style.background=''">
      <div style="font-weight:600;font-family:var(--mono);letter-spacing:0.03em;">DNI ${escapeHtml(p.dni||'—')}</div>
      <div style="font-weight:500;">${escapeHtml(p.nombre||'')}</div>
      <div style="font-size:11px;color:var(--text3);">${escapeHtml(p.area||'')} · ${escapeHtml(p.cargo||'')}</div>
    </div>`;
}

/**
 * Guarda o actualiza una persona en la lista local y encola envío al Sheet.
 * @returns {object|null} persona normalizada o null si no hay datos mínimos
 */
function upsertPersonalLocal(raw){
  const p=normalizarPersona(raw);
  if(!p.dni && !p.nombre) return null;
  // Preferir DNI como clave; si no hay DNI, no duplicar por nombre exacto
  const list=getPersonal();
  let idx=-1;
  if(p.dni){
    idx=list.findIndex(x=>String(x.dni).trim()===p.dni);
  } else if(p.nombre){
    idx=list.findIndex(x=>!x.dni && (x.nombre||'').toLowerCase()===p.nombre.toLowerCase());
  }
  if(idx>=0){
    list[idx]={...list[idx], ...p, dni:p.dni||list[idx].dni};
  } else {
    list.push(p);
  }
  savePersonal(list);

  // Encolar para Google Sheet (solo si hay DNI o nombre usable)
  if(p.dni || p.nombre){
    const updates=getPendingUpdates();
    // Evitar duplicar la misma alta pendiente
    const ya=updates.some(u=>u.type==='personal_add' && (
      (p.dni && String(u.payload?.dni)===p.dni) ||
      (!p.dni && (u.payload?.nombre||'').toLowerCase()===p.nombre.toLowerCase())
    ));
    if(!ya){
      updates.push({type:'personal_add', payload:p, at:Date.now()});
      savePendingUpdates(updates);
    } else {
      // Actualizar payload pendiente con datos más nuevos
      const i=updates.findIndex(u=>u.type==='personal_add' && (
        (p.dni && String(u.payload?.dni)===p.dni) ||
        (!p.dni && (u.payload?.nombre||'').toLowerCase()===p.nombre.toLowerCase())
      ));
      if(i>=0) updates[i].payload=p;
      savePendingUpdates(updates);
    }
  }
  return p;
}

/** Al guardar reporte: crear/actualizar persona reportada si tiene datos. */
function guardarPersonasDelFormulario(){
  // Persona reportada
  const dniO=g('dniObservado');
  const nomO=g('persona');
  if(dniO || nomO){
    upsertPersonalLocal({
      dni:dniO,
      nombre:nomO,
      cargo:g('cargoReportado'),
      area:g('areaReportado'),
    });
  }
}

// ── Observado (persona reportada): autocomplete o alta ──
let observadoSeleccionado = null;

function buscarObservadoPorNombre(){
  const q = (document.getElementById('persona').value||'').trim();
  const dropdown = document.getElementById('observadoDropdown');
  const status = document.getElementById('observadoStatus');
  const dniDd=document.getElementById('dniObservadoDropdown');
  if(dniDd) dniDd.style.display='none';

  if(!q){
    dropdown.style.display='none';
    return;
  }

  const resultados = buscarPersonal(q);

  if(!resultados.length){
    dropdown.style.display='none';
    if(!observadoSeleccionado){
      status.className='dni-status notfound';
      status.textContent='Persona nueva — complete DNI, área y cargo; se guardará al registrar';
    }
    return;
  }

  const exactDni=soloDigitos(q).length>=6 && resultados.length===1 && dniDe(resultados[0]).startsWith(soloDigitos(q));
  if(exactDni && dniDe(resultados[0])===soloDigitos(q)){
    dropdown._results=resultados;
    seleccionarObservadoObj(resultados[0]);
    return;
  }

  dropdown.innerHTML = resultados.map((p,i)=>htmlOpcionPersona(p,i,'seleccionarObservado')).join('') + `
    <div onclick="marcarObservadoNuevo()"
         style="padding:10px 14px;cursor:pointer;font-size:12px;color:var(--accent);font-weight:500;background:var(--surface2);">
      ＋ Usar «${escapeHtml(q)}» como persona nueva
    </div>`;
  dropdown._results = resultados;
  dropdown.style.display='block';
  if(observadoSeleccionado && (observadoSeleccionado.nombre||'').toLowerCase()===q.toLowerCase()){
    status.className='dni-status found';
    status.textContent='✓ '+escapeHtml(observadoSeleccionado.nombre)+' · DNI '+escapeHtml(observadoSeleccionado.dni||'');
  } else {
    status.className='dni-status';
    status.textContent='Seleccione de la lista (búsqueda por DNI) o cree persona nueva';
  }
}

function marcarObservadoNuevo(){
  const dropdown = document.getElementById('observadoDropdown');
  if(dropdown) dropdown.style.display='none';
  observadoSeleccionado=null;
  const status = document.getElementById('observadoStatus');
  status.className='dni-status notfound';
  status.textContent='Persona nueva — complete DNI, área y cargo';
  const dni=document.getElementById('dniObservado');
  if(dni) dni.focus();
}

function onDniObservadoInput(){
  const el=document.getElementById('dniObservado');
  if(!el) return;
  el.value=soloDigitos(el.value).slice(0,8);
  const dni=el.value.trim();
  const status=document.getElementById('observadoStatus');
  const dropdown=document.getElementById('dniObservadoDropdown');
  const nomDd=document.getElementById('observadoDropdown');
  if(nomDd) nomDd.style.display='none';

  if(!dni){
    if(dropdown) dropdown.style.display='none';
    if(status){ status.className='dni-status'; status.textContent=''; }
    return;
  }

  const resultados=buscarPersonalPorDniPrefijo(dni);
  const exacto=resultados.find(p=>dniDe(p)===dni);

  if(exacto){
    if(dropdown) dropdown.style.display='none';
    seleccionarObservadoObj(exacto);
    return;
  }

  if(!resultados.length){
    if(dropdown) dropdown.style.display='none';
    observadoSeleccionado=null;
    status.className='dni-status notfound';
    status.textContent=dni.length===8
      ? 'DNI nuevo — complete nombre, área y cargo; se guardará al registrar'
      : 'Sin coincidencia por DNI — siga escribiendo o complete los datos';
    return;
  }

  if(dropdown){
    dropdown.innerHTML=resultados.map((p,i)=>htmlOpcionPersona(p,i,'seleccionarObservadoDesdeDni')).join('');
    dropdown._results=resultados;
    dropdown.style.display='block';
  }
  status.className='dni-status';
  status.textContent=dni.length<8
    ? 'Escriba el DNI — se autocompleta al coincidir'
    : 'Seleccione la persona de la lista';
}

function seleccionarObservadoDesdeDni(idx){
  const dropdown=document.getElementById('dniObservadoDropdown');
  const p=dropdown && dropdown._results ? dropdown._results[idx] : null;
  if(!p) return;
  seleccionarObservadoObj(p);
}

function seleccionarObservado(idx){
  const dropdown = document.getElementById('observadoDropdown');
  const p = dropdown._results[idx];
  if(!p) return;
  seleccionarObservadoObj(p);
}

function seleccionarObservadoObj(p){
  if(!p) return;
  observadoSeleccionado = p;
  document.getElementById('persona').value = p.nombre||'';
  document.getElementById('dniObservado').value = dniDe(p) || (p.dni||'');
  document.getElementById('areaReportado').value = p.area||'';
  document.getElementById('cargoReportado').value = p.cargo||'';
  const dropdown = document.getElementById('observadoDropdown');
  if(dropdown) dropdown.style.display='none';
  const dniDd=document.getElementById('dniObservadoDropdown');
  if(dniDd) dniDd.style.display='none';
  const status = document.getElementById('observadoStatus');
  status.className='dni-status found';
  status.textContent='✓ DNI '+escapeHtml(p.dni||'')+' — '+escapeHtml(p.nombre||'')+' (datos completados)';
}

function autocompletarPorDniSiExacto(q, resultados, aplicar){
  const d=soloDigitos(q);
  if(!d || d.length<6 || !resultados.length) return false;
  const exactos=resultados.filter(p=>dniDe(p)===d);
  if(exactos.length===1){ aplicar(exactos[0]); return true; }
  return false;
}

// ── Responsable acción correctiva: autocomplete por DNI (preferente) o nombre ──
function buscarResponsable(){
  const q = (document.getElementById('responsable').value||'').trim();
  const dd = document.getElementById('responsableDropdown');
  const status = document.getElementById('responsableStatus');
  if(!dd) return;
  if(!q){ dd.style.display='none'; return; }

  const resultados = buscarPersonal(q);

  if(!resultados.length){
    dd.style.display='none';
    if(status){
      status.className='dni-status notfound';
      status.textContent='Sin coincidencia por DNI — puede escribir el nombre igual';
    }
    return;
  }

  if(autocompletarPorDniSiExacto(q, resultados, p=>seleccionarResponsableObj(p))) return;

  dd.innerHTML = resultados.map((p,i)=>htmlOpcionPersona(p,i,'seleccionarResponsable')).join('');
  dd._results = resultados;
  dd.style.display='block';
  if(status){
    status.className='dni-status';
    status.textContent='Seleccione de la lista (preferencia por DNI)';
  }
}

function seleccionarResponsable(idx){
  const dd = document.getElementById('responsableDropdown');
  const p = dd._results[idx];
  if(!p) return;
  seleccionarResponsableObj(p);
}

function seleccionarResponsableObj(p){
  if(!p) return;
  document.getElementById('responsable').value = p.nombre||'';
  const dd = document.getElementById('responsableDropdown');
  if(dd) dd.style.display='none';
  const status = document.getElementById('responsableStatus');
  if(status){
    status.className='dni-status found';
    status.textContent='✓ DNI '+escapeHtml(p.dni||'')+' — '+escapeHtml(p.nombre||'');
  }
}

// ── Jefe inmediato: autocomplete por DNI (preferente) o nombre ──
function buscarJefeInmediato(){
  const q = (document.getElementById('jefeInmediato').value||'').trim();
  const dd = document.getElementById('jefeInmediatoDropdown');
  const status = document.getElementById('jefeInmediatoStatus');
  if(!dd) return;
  if(!q){ dd.style.display='none'; return; }

  const resultados = buscarPersonal(q);

  if(!resultados.length){
    dd.style.display='none';
    if(status){
      status.className='dni-status notfound';
      status.textContent='Sin coincidencia por DNI — puede escribir el nombre igual';
    }
    return;
  }

  if(autocompletarPorDniSiExacto(q, resultados, p=>seleccionarJefeInmediatoObj(p))) return;

  dd.innerHTML = resultados.map((p,i)=>htmlOpcionPersona(p,i,'seleccionarJefeInmediato')).join('');
  dd._results = resultados;
  dd.style.display='block';
  if(status){
    status.className='dni-status';
    status.textContent='Seleccione de la lista (preferencia por DNI)';
  }
}

function seleccionarJefeInmediato(idx){
  const dd = document.getElementById('jefeInmediatoDropdown');
  const p = dd._results[idx];
  if(!p) return;
  seleccionarJefeInmediatoObj(p);
}

function seleccionarJefeInmediatoObj(p){
  if(!p) return;
  document.getElementById('jefeInmediato').value = p.nombre||'';
  const dd = document.getElementById('jefeInmediatoDropdown');
  if(dd) dd.style.display='none';
  const status = document.getElementById('jefeInmediatoStatus');
  if(status){
    status.className='dni-status found';
    status.textContent='✓ DNI '+escapeHtml(p.dni||'')+' — '+escapeHtml(p.nombre||'');
  }
}

function limpiarObservado(){
  document.getElementById('dniObservado').value='';
  document.getElementById('areaReportado').value='';
  document.getElementById('cargoReportado').value='';
  observadoSeleccionado=null;
}

// Cerrar dropdowns al tocar fuera
document.addEventListener('click', e=>{
  [
    {id:'observadoDropdown',  inputId:'persona'},
    {id:'dniObservadoDropdown',inputId:'dniObservado'},
    {id:'responsableDropdown',inputId:'responsable'},
    {id:'jefeInmediatoDropdown',inputId:'jefeInmediato'},
  ].forEach(({id, inputId})=>{
    const dd=document.getElementById(id);
    if(dd && !dd.contains(e.target) && e.target.id!==inputId) dd.style.display='none';
  });
});

/* ───── VALIDACIÓN Y MANEJO DE FOTOS ───── */
const IMAGE_SIGNATURES = [
  [0xFF,0xD8,0xFF],           // JPEG
  [0x89,0x50,0x4E,0x47],      // PNG
  [0x47,0x49,0x46],           // GIF
  [0x52,0x49,0x46,0x46],      // WEBP (RIFF)
];

function validarFirmaImagen(arrayBuffer){
  const bytes = new Uint8Array(arrayBuffer).slice(0,8);
  return IMAGE_SIGNATURES.some(sig => sig.every((b,i) => bytes[i]===b));
}

function handlePhotos(input, modo){
  const TIPOS_VALIDOS = ['image/jpeg','image/png','image/gif','image/webp'];
  const MAX_MB = 10;
  // Determinar a qué array agregar y dónde renderizar
  let target, previewId;
  if(modo==='hallazgo'){ target=photoDataURLs; previewId='photosPreview'; }
  else if(modo==='entrega'){ target=photoEntregaDataURLs; previewId='photosEntregaPreview'; }
  else if(modo==='levantamiento'){ target=photoLevDataURLs; previewId='photosLevPreview'; }
  else if(modo==='editLev'){ target=editPhotoLevDataURLs; previewId='editPhotosLevPreview'; }

  const files = Array.from(input.files).slice(0, 5-target.length);

  files.forEach(f=>{
    if(!TIPOS_VALIDOS.includes(f.type)){
      showToast('❌ Solo se permiten imágenes (JPG, PNG, WEBP)');
      return;
    }
    if(f.size > MAX_MB * 1024 * 1024){
      showToast('❌ La imagen supera los 10MB');
      return;
    }
    const sliceReader = new FileReader();
    sliceReader.onload = e2 => {
      if(!validarFirmaImagen(e2.target.result)){
        showToast('❌ Archivo rechazado: no es una imagen válida');
        return;
      }
      const r = new FileReader();
      r.onload = e => {
        if(target.length>=5) return;
        const img = new Image();
        img.onload = () => {
          const MAX=1024;
          let w=img.width, h=img.height;
          if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
          const canvas=document.createElement('canvas');
          canvas.width=w; canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const compressed=canvas.toDataURL('image/jpeg',0.7);
          if(target.length<5){
            target.push(compressed);
            renderPhotosPreview(modo);
          }
        };
        img.onerror=()=>showToast('❌ No se pudo procesar la imagen');
        img.src=e.target.result;
      };
      r.readAsDataURL(f);
    };
    sliceReader.readAsArrayBuffer(f.slice(0,8));
  });
  input.value='';
}

function renderPhotosPreview(modo){
  let target, previewId, removeFunc;
  if(modo==='hallazgo'){ target=photoDataURLs; previewId='photosPreview'; removeFunc='removePhoto'; }
  else if(modo==='entrega'){ target=photoEntregaDataURLs; previewId='photosEntregaPreview'; removeFunc='removePhotoEntrega'; }
  else if(modo==='levantamiento'){ target=photoLevDataURLs; previewId='photosLevPreview'; removeFunc='removePhotoLev'; }
  else if(modo==='editLev'){ target=editPhotoLevDataURLs; previewId='editPhotosLevPreview'; removeFunc='removeEditPhotoLev'; }
  const el=document.getElementById(previewId);
  if(!el) return;
  el.innerHTML=target.map((u,i)=>
    `<div class="photo-thumb-wrap"><img src="${u}" class="photo-thumb"><button class="photo-remove" onclick="${removeFunc}(${i})">×</button></div>`
  ).join('');
}

function removePhoto(i){photoDataURLs.splice(i,1);renderPhotosPreview('hallazgo');}
function removePhotoEntrega(i){photoEntregaDataURLs.splice(i,1);renderPhotosPreview('entrega');}
function removePhotoLev(i){photoLevDataURLs.splice(i,1);renderPhotosPreview('levantamiento');}
function removeEditPhotoLev(i){editPhotoLevDataURLs.splice(i,1);renderPhotosPreview('editLev');}

function g(id){return(document.getElementById(id)?.value||'').trim();}

function actualizarContadorDesc(){
  const el=document.getElementById('descripcion');
  const c=document.getElementById('descCounter');
  if(!el||!c) return;
  const n=(el.value||'').trim().length;
  c.textContent=n>=DESC_MIN
    ? 'Descripción detallada · '+n+' caracteres'
    : 'Mínimo '+DESC_MIN+' caracteres · '+n+'/'+DESC_MIN;
  c.className='desc-counter '+(n>=DESC_MIN?'is-ok':'is-low');
}

function cantidadEppsDe(r){
  const n=parseInt(r&&r.cantidadEpps,10);
  return Number.isFinite(n)&&n>0?n:1;
}

function fechaKeyDia(f){
  const p=parseFechaParts(f);
  if(!p) return '';
  return p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0');
}

function mapaEppsPorDia(anio, mes){
  const map={};
  getReportes().forEach(r=>{
    const p=parseFechaParts(r.fecha);
    if(!p) return;
    if(anio && p.y!==anio) return;
    if(mes && p.m!==mes) return;
    const k=fechaKeyDia(r.fecha);
    if(!map[k]) map[k]={y:p.y,m:p.m,d:p.d,reportes:0,epps:0};
    map[k].reportes++;
    map[k].epps+=cantidadEppsDe(r);
  });
  return map;
}

/* ───── GUARDAR REPORTE ───── */
function guardarReporte(){
  if(!selectedEstado)      {showToast('⚠ Selecciona el estado del reporte');return;}
  if(!selectedTipo)        {showToast('⚠ Selecciona el tipo de reporte');return;}
  if(!g('categoria'))      {showToast('⚠ Selecciona una categoría');return;}
  if(g('categoria')==='Otro' && !g('categoriaOtro')){showToast('⚠ Describe la categoría en Otro');return;}
  const desc=g('descripcion');
  if(!desc){showToast('⚠ Ingresa una descripción detallada del cambio');return;}
  if(desc.length<DESC_MIN){
    showToast('⚠ La descripción debe ser más detallada (mínimo '+DESC_MIN+' caracteres)');
    return;
  }
  const cant=parseInt(g('cantidadEpps'),10);
  if(!Number.isFinite(cant) || cant<1){
    showToast('⚠ Indica cuántos EPPS se cambian (mínimo 1)');
    return;
  }

  if(!g('responsable'))    {showToast('⚠ Ingresa el responsable de la acción correctiva');return;}
  if(!g('jefeInmediato'))  {showToast('⚠ Ingresa el jefe inmediato');return;}
  if(!g('ubicacion'))      {showToast('⚠ Selecciona el Área / Ubicación');return;}
  if(g('ubicacion')==='Otros' && !g('ubicacionOtros')){showToast('⚠ Especifica la ubicación');return;}
  if(!g('areaReportado'))  {showToast('⚠ Indica el área de la persona reportada');return;}
  if(!g('fecha'))          {showToast('⚠ Ingresa la fecha');return;}
  if(!g('hora'))           {showToast('⚠ Ingresa la hora');return;}
  // Persona reportada: si hay nombre o DNI parcial, pedir datos mínimos
  if(g('dniObservado') && g('dniObservado').length!==8){
    showToast('⚠ El DNI de la persona reportada debe tener 8 dígitos o dejarse vacío');
    return;
  }
  if(g('persona') && !g('dniObservado') && !g('areaReportado')){
    showToast('⚠ Complete área (y DNI si puede) de la persona reportada');
    return;
  }

  if(!getFirmaDataURL('firmaCanvas')){showToast('⚠ Dibuja tu firma para continuar');return;}
  if(!photoEntregaDataURLs.length){
    showToast('⚠ Toma la foto del personal que recibe el EPP');
    return;
  }

  // Si está cerrado, validar campos de levantamiento
  if(selectedEstado==='Cerrado'){

    if(!g('medidasAcciones')){showToast('⚠ Describe las medidas/acciones realizadas');return;}
  }

  // dniObservado viene del campo hidden (seteado al seleccionar del dropdown)
  const dniObs=g('dniObservado'), persona=g('persona'), areaObs=g('areaReportado'), cargoObs=g('cargoReportado');

  const reporte={
    id:Date.now().toString(),
    estado:selectedEstado,
    tipo:selectedTipo,
    nivelRiesgo:selectedRiesgo,
    categoria:g('categoria')==='Otro'?g('categoriaOtro'):g('categoria'),
    causaProbable:causaSeleccionadaValor,
    descripcion:desc,
    cantidadEpps:cant,
    responsable:g('responsable'),
    jefeInmediato:g('jefeInmediato'),
    ubicacion:g('ubicacion')==='Otros'?g('ubicacionOtros'):g('ubicacion')==='Interior Mina'&&g('ubicacionInterior')?'Interior Mina - '+g('ubicacionInterior'):g('ubicacion'),
    persona:persona,
    dniObservado:dniObs,
    areaReportado:areaObs,
    cargoReportado:cargoObs,
    fecha:g('fecha'),
    hora:g('hora'),
    reportador:REPORTANTE_DEFAULT,
    dniReportador:'',
    areaReportador:'',
    cargoReportador:'',
    fotos:photoDataURLs,
    fotosEntrega:photoEntregaDataURLs,
    fotosLevantamiento:[],
    medidasAcciones:selectedEstado==='Cerrado'?g('medidasAcciones'):'',
    fechaCierre:selectedEstado==='Cerrado'?new Date().toISOString():'',
    createdAt:new Date().toISOString(),
    firmaRegistro:getFirmaDataURL('firmaCanvas'),
    firmaEdicion:null,
    synced:false,
  };

  // Guardar / actualizar persona reportada si es nueva o cambiaron datos
  guardarPersonasDelFormulario();

  // Guardar objeto completo en cola de pendientes
  const pending=getPending();
  pending.unshift(reporte); // al inicio para que aparezca primero
  savePending(pending);

  resetForm();
  renderStats();
  updateLiveStamp();
  mostrarAvisoNoRetirarse(
    navigator.onLine
      ? 'Espere hasta que el reporte se sincronice. No cierre ni salga de la aplicación.'
      : 'Reporte guardado localmente. No se retire hasta que haya internet y se complete la sincronización.'
  );
  showToast(
    navigator.onLine
      ? '✓ Registrado — no se retire hasta que sincronice'
      : '✓ Guardado localmente — no se retire hasta que sincronice'
  );
  if(navigator.onLine) autoSync();
  else actualizarAvisoPendiente();
  showTab('reportes');
}

function toggleCategoriaOtro(){
  const sel=document.getElementById('categoria');
  const wrap=document.getElementById('categoriaOtroWrap');
  if(sel && wrap) wrap.style.display=sel.value==='Otro'?'block':'none';
}

function toggleUbicacionOtros(){
  const sel=document.getElementById('ubicacion');
  const wrap=document.getElementById('ubicacionOtrosWrap');
  const interiorWrap=document.getElementById('ubicacionInteriorWrap');
  if(sel && wrap) wrap.style.display=sel.value==='Otros'?'block':'none';
  if(sel && interiorWrap) interiorWrap.style.display=sel.value==='Interior Mina'?'block':'none';
}

function resetForm(){
  selectedTipo=''; selectedRiesgo=''; selectedEstado='Cerrado';
  photoDataURLs=[]; photoLevDataURLs=[]; photoEntregaDataURLs=[];
  document.querySelectorAll('#tipo-chips .chip,#riesgo-chips .chip').forEach(c=>c.className='chip');
  document.querySelectorAll('#estado-chips .chip').forEach(c=>{
    c.className='chip'+(c.dataset.value==='Cerrado'?' sel-cerrado':'');
  });
  document.getElementById('seccionLevantamiento').style.display='block';
  ['descripcion','responsable','jefeInmediato','persona','dniObservado','cargoReportado',
   'areaReportado','ubicacionOtros','medidasAcciones'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const cantEl=document.getElementById('cantidadEpps');
  if(cantEl) cantEl.value='1';
  actualizarContadorDesc();
  ['categoria','ubicacion'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('ubicacionOtrosWrap').style.display='none';
  document.getElementById('ubicacionInteriorWrap').style.display='none';
  document.getElementById('categoriaOtroWrap').style.display='none';
  const obsS=document.getElementById('observadoStatus');
  if(obsS){obsS.className='dni-status';obsS.textContent='';}
  const respS=document.getElementById('responsableStatus');
  if(respS){respS.className='dni-status';respS.textContent='';}
  const jefeS=document.getElementById('jefeInmediatoStatus');
  if(jefeS){jefeS.className='dni-status';jefeS.textContent='';}
  ['observadoDropdown','responsableDropdown','jefeInmediatoDropdown'].forEach(id=>{
    const dd=document.getElementById(id); if(dd) dd.style.display='none';
  });
  observadoSeleccionado=null;
  causaSeleccionadaValor='';
  const cs=document.getElementById('causaSeleccionada');if(cs){cs.style.display='none';cs.textContent='';}
  const cdd=document.getElementById('causaDropdown');if(cdd)cdd.style.display='none';
  const co=document.getElementById('categoriaOtro'); if(co) co.value='';
  limpiarFirma('firmaCanvas');
  document.getElementById('photosPreview').innerHTML='';
  const pe=document.getElementById('photosEntregaPreview'); if(pe) pe.innerHTML='';
  const pl=document.getElementById('photosLevPreview'); if(pl) pl.innerHTML='';
  document.getElementById('fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('hora').value=new Date().toTimeString().slice(0,5);
}

/* ───── FILTROS DE LISTA ───── */
function limpiarFiltros(){
  filtroRiesgo=''; filtroCategoria=''; filtroTipo='';
  filtroUbicacion=''; filtroPersona='';
  renderReportes();
}

function limpiarFiltrosStats(){
  filtroRiesgo=''; filtroCategoria=''; filtroTipo='';
  filtroUbicacion=''; filtroPersona='';
  renderStats();
}

function setFiltroEstado(estado){
  filtroEstadoLista=estado;
  setFiltroEstadoBtnActive();
  renderReportes();
}

function setFiltroEstadoBtnActive(){
  const map={'':'filterEstadoTodos','Abierto':'filterEstadoAbierto','Cerrado':'filterEstadoCerrado'};
  ['filterEstadoTodos','filterEstadoAbierto','filterEstadoCerrado'].forEach(id=>{
    document.getElementById(id).className='chip';
  });
  const activeId=map[filtroEstadoLista];
  if(activeId){
    const cls=filtroEstadoLista==='Abierto'?'sel-abierto':(filtroEstadoLista==='Cerrado'?'sel-cerrado':'sel-both');
    document.getElementById(activeId).className='chip '+cls;
  }
}

/* ───── RENDER REPORTES ───── */
function renderReportes(){
  const list=document.getElementById('reportesList');
  if(!list) return;
  const banner=document.getElementById('filtroActivoBanner');
  const texto=document.getElementById('filtroActivoTexto');
  if(banner && texto){
    if(filtroRiesgo){ banner.style.display='flex'; texto.textContent='Filtro: Riesgo '+filtroRiesgo; }
    else if(filtroCategoria){ banner.style.display='flex'; texto.textContent='Filtro: '+filtroCategoria; }
    else { banner.style.display='none'; }
  }
  let data=getReportes();
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const tipo=document.getElementById('filterTipo')?.value||'';
  if(q) data=data.filter(r=>
    (r.descripcion||'').toLowerCase().includes(q)||
    (r.ubicacion||'').toLowerCase().includes(q)||
    (r.categoria||'').toLowerCase().includes(q)||
    (r.reportador||'').toLowerCase().includes(q)||
    (r.responsable||'').toLowerCase().includes(q)||
    (r.jefeInmediato||'').toLowerCase().includes(q)
  );
  if(tipo) data=data.filter(r=>r.tipo===tipo);
  if(filtroRiesgo) data=data.filter(r=>r.nivelRiesgo===filtroRiesgo);
  if(filtroCategoria) data=data.filter(r=>r.categoria===filtroCategoria);
  if(filtroTipo) data=data.filter(r=>r.tipo===filtroTipo);
  if(filtroEstadoLista) data=data.filter(r=>(r.estado||'Abierto')===filtroEstadoLista);

  if(!data.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><h3>Sin reportes</h3><p style="font-size:13px;">Los reportes guardados aparecerán aquí</p></div>`;
    return;
  }

  const badgeMap={'Acto Subestándar':'badge-act','Condición Subestándar':'badge-cond','Casi Accidente':'badge-near'};
  const riskMap={'Alto':'risk-alto','Medio':'risk-medio','Bajo':'risk-bajo'};
  const labelMap={'Acto Subestándar':'ACTO','Condición Subestándar':'COND','Casi Accidente':'CASI'};

  list.innerHTML=data.map(r=>{
    const estado=r.estado||'Abierto';
    const estClass=estado==='Cerrado'?'estado-cerrado':'estado-abierto';
    return `
    <div class="report-card" onclick="openModal('${r.id}')">
      <div class="report-card-header">
        <div class="risk-dot ${riskMap[r.nivelRiesgo]||'risk-bajo'}"></div>
        <div class="report-title">${escapeHtml((r.descripcion||'').slice(0,80))}${(r.descripcion||'').length>80?'…':''}</div>        <span class="report-type-badge ${badgeMap[r.tipo]||'badge-both'}">${labelMap[r.tipo]||r.tipo}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span class="estado-badge ${estClass}"><span class="estado-dot"></span>${estado}</span>
        <span style="font-size:12px;color:var(--text3);font-family:var(--mono);">${fmtFecha(r.fecha)}</span>
      </div>
      <div class="report-meta">
        ${r.ubicacion?`<span>📍 ${escapeHtml(r.ubicacion)}</span>`:''}
        ${r.categoria?`<span>🏷 ${escapeHtml(r.categoria)}</span>`:''}
        ${r.jefeInmediato?`<span>👔 ${escapeHtml(r.jefeInmediato)}</span>`:''}
        <span>👤 ${escapeHtml(r.reportador||REPORTANTE_DEFAULT)}</span>
      </div>
      <div class="sync-status ${r.synced?'status-synced':'status-pending'}">
        <div class="dot"></div>${r.synced?'Sincronizado':'Pendiente de sincronizar'}
      </div>
    </div>`;
  }).join('');
}

function escapeHtml(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Extrae año/mes/día de cualquier formato (input date, Sheets, ISO, DD/MM/YYYY)
function parseFechaParts(f){
  if(f==null||f==='') return null;
  if(f instanceof Date && !isNaN(f)){
    return {y:f.getFullYear(), m:f.getMonth()+1, d:f.getDate()};
  }
  const s=String(f).trim();
  let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(m) return {y:+m[1], m:+m[2], d:+m[3]};
  m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if(m) return {y:+m[3], m:+m[2], d:+m[1]};
  const dt=new Date(f);
  if(!isNaN(dt)) return {y:dt.getFullYear(), m:dt.getMonth()+1, d:dt.getDate()};
  return null;
}

function fechaKeyMes(f){
  const p=parseFechaParts(f);
  if(!p) return '';
  return p.y+'-'+String(p.m).padStart(2,'0');
}

// Normaliza cualquier formato de fecha a YYYY/MM/DD
function fmtFecha(f){
  const p=parseFechaParts(f);
  if(!p) return f?String(f):'—';
  return p.y+'/'+String(p.m).padStart(2,'0')+'/'+String(p.d).padStart(2,'0');
}

function logoPrintSrc(){
  if(typeof LOGO_DATA==='string' && LOGO_DATA.indexOf('data:image')===0) return LOGO_DATA;
  try{
    const file=(typeof APP!=='undefined'&&APP.logo)?APP.logo:'cita_minera_casma_sac-removebg-preview.png';
    return new URL(file, window.location.href).href;
  }catch(e){
    return 'cita_minera_casma_sac-removebg-preview.png';
  }
}



// Convierte link de Drive a URL embebible para firmas
function firmaImgUrl(url){
  if(!url || url==='null') return '';
  if(url.startsWith('data:')) return url; // dataURL local, usar directo
  const m = url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  if(m) return 'https://lh3.googleusercontent.com/d/'+m[1]+'=w300';
  return url;
}

/* ───── MODAL DETALLE ───── */
// Normaliza fotos: acepta array, string "url1 | url2", o vacío → siempre devuelve array limpio
function toArray(val){
  if(!val) return [];
  if(Array.isArray(val)) return val.filter(v=>v&&String(v).trim());
  if(typeof val==='string') return val.split('|').map(s=>s.trim()).filter(Boolean);
  return [];
}

// Convierte cualquier formato de link de Drive a URL embebible para <img>
// Todos los formatos se normalizan a: /file/d/ID/preview (renderiza en iframe/img sin bloqueo)
function driveImgUrl(url){
  if(!url) return '';
  // extraer ID desde /file/d/ID/...
  let m = url.match(/\/file\/d\/([\w-]+)/);
  if(m) return 'https://drive.google.com/file/d/'+m[1]+'/preview';
  // extraer ID desde uc?id=ID o open?id=ID
  m = url.match(/[?&]id=([\w-]+)/);
  if(m) return 'https://drive.google.com/file/d/'+m[1]+'/preview';
  return url;
}

function openModal(id){
  const r=getReportes().find(x=>x.id===id);
  if(!r) return;
  const rc={'Alto':'var(--danger)','Medio':'var(--warning)','Bajo':'var(--success)'};
  const color=rc[r.nivelRiesgo]||'var(--text2)';
  const estado=r.estado||'Abierto';
  const estColor=estado==='Cerrado'?'var(--success)':'var(--danger)';
  const row=(label,val,full)=>val?`<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value"${full?' style="text-align:left;flex:1;margin-left:16px;"':''}>${val}</span></div>`:'';
  const sec=t=>`<div class="detail-section">${t}</div>`;

  const fotosHallazgo=toArray(r.fotos).length?toArray(r.fotos):toArray(r.linksFotos);
  const fotosEntrega=toArray(r.fotosEntrega).length?toArray(r.fotosEntrega):toArray(r.linksFotosEntrega);
  const fotosLev=toArray(r.fotosLevantamiento).length?toArray(r.fotosLevantamiento):toArray(r.linksFotosLevantamiento);

  document.getElementById('modalContent').innerHTML=`
    <div class="modal-title">${escapeHtml(r.tipo)}</div>
    <div class="detail-row"><span class="detail-label">Estado</span><span class="detail-value" style="color:${estColor};font-weight:600;">● ${escapeHtml(estado)}</span></div>
    ${row('Nivel de riesgo',`<span style="color:${color};font-weight:500">● ${escapeHtml(r.nivelRiesgo)}</span>`)}
    ${row('Categoría',escapeHtml(r.categoria))}
    ${row('EPPS cambiados', String(cantidadEppsDe(r)))}
    ${row('Descripción',escapeHtml(r.descripcion),true)}
    ${row('Responsable de acción',escapeHtml(r.responsable))}
    ${row('Jefe inmediato',escapeHtml(r.jefeInmediato))}
    ${sec('Lugar / Persona reportada')}
    ${row('Área / Ubicación',escapeHtml(r.ubicacion))}
    ${row('Persona reportada',escapeHtml(r.persona))}
    ${row('DNI observado',escapeHtml(r.dniObservado))}
    ${row('Área del observado',escapeHtml(r.areaReportado))}
    ${row('Cargo del observado',escapeHtml(r.cargoReportado))}
    ${row('Reportante',escapeHtml(r.reportador||REPORTANTE_DEFAULT))}
    ${row('Fecha',fmtFecha(r.fecha))}
    ${estado==='Cerrado'?sec('Cierre'):''}
    ${estado==='Cerrado'&&r.medidasAcciones?row('Acciones realizadas',escapeHtml(r.medidasAcciones),true):''}
    ${estado==='Cerrado'&&r.fechaCierre?row('Fecha cierre',fmtFecha(r.fechaCierre)):''}
    <div class="detail-row"><span class="detail-label">Sincronización</span>
      <span class="detail-value ${r.synced?'status-synced':'status-pending'}">${r.synced?'✓ Sincronizado':'⏳ Pendiente'}</span>
    </div>
    ${fotosHallazgo.length?`<div style="margin-top:14px;"><div class="section-title">Fotos del hallazgo (${fotosHallazgo.length})</div><div class="photos-modal-grid">${fotosHallazgo.map(f=>{const gid=(typeof f==='string'&&(f.match(/[?&]id=([\w-]+)/)||f.match(/\/d\/([\w-]+)/)))?.[1];const src=gid?'https://lh3.googleusercontent.com/d/'+gid+'=w400':f;return`<div style="position:relative;width:100%;aspect-ratio:1;background:var(--surface2);border-radius:var(--radius-sm);overflow:hidden;"><img src="${src}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"><a href="${typeof f==='string'?f:''}" target="_blank" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:3px 7px;border-radius:10px;text-decoration:none;">↗ Ver</a></div>`;}).join('')}</div></div>`:''}
    ${fotosEntrega.length?`<div style="margin-top:14px;"><div class="section-title">Fotos del personal (${fotosEntrega.length})</div><div class="photos-modal-grid">${fotosEntrega.map(f=>{const gid=(typeof f==='string'&&(f.match(/[?&]id=([\w-]+)/)||f.match(/\/d\/([\w-]+)/)))?.[1];const src=gid?'https://lh3.googleusercontent.com/d/'+gid+'=w400':f;return`<div style="position:relative;width:100%;aspect-ratio:1;background:var(--surface2);border-radius:var(--radius-sm);overflow:hidden;"><img src="${src}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"><a href="${typeof f==='string'?f:''}" target="_blank" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:3px 7px;border-radius:10px;text-decoration:none;">↗ Ver</a></div>`;}).join('')}</div></div>`:''}
    ${fotosLev.length?`<div style="margin-top:14px;"><div class="section-title">Fotos de cierre (${fotosLev.length})</div><div class="photos-modal-grid">${fotosLev.map(f=>{const gid=(typeof f==='string'&&(f.match(/[?&]id=([\w-]+)/)||f.match(/\/d\/([\w-]+)/)))?.[1];const src=gid?'https://lh3.googleusercontent.com/d/'+gid+'=w400':f;return`<div style="position:relative;width:100%;aspect-ratio:1;background:var(--surface2);border-radius:var(--radius-sm);overflow:hidden;"><img src="${src}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"><a href="${typeof f==='string'?f:''}" target="_blank" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:3px 7px;border-radius:10px;text-decoration:none;">↗ Ver</a></div>`;}).join('')}</div></div>`:''}
    ${firmaImgUrl(r.firmaRegistro)?'<div style="margin-top:14px;"><div class="section-title">Firma Registrador</div><img src="'+firmaImgUrl(r.firmaRegistro)+'" style="max-width:200px;border-bottom:1px solid var(--border2);" onerror="this.style.display=\'none\'"></div>':''}
    ${firmaImgUrl(r.firmaEdicion)?'<div style="margin-top:10px;"><div class="section-title">Firma Editor</div><img src="'+firmaImgUrl(r.firmaEdicion)+'" style="max-width:200px;border-bottom:1px solid var(--border2);" onerror="this.style.display=\'none\'"></div>':''}
    <div class="modal-actions">
      <button class="btn-close-modal" onclick="closeModalBtn()">Cerrar</button>
      <button class="btn-secondary" onclick="generarVale('${r.id}')" style="background:var(--warning-dim);color:var(--warning);border:1px solid var(--warning);">🖨 Imprimir</button>
      <button class="btn-edit" onclick="abrirEdicion('${r.id}')">Editar</button>
      <button class="btn-delete" onclick="deleteReporte('${r.id}')">Eliminar</button>
    </div>`;

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e){if(e.target===document.getElementById('modalOverlay')) closeModalBtn();}
function closeModalBtn(){document.getElementById('modalOverlay').classList.remove('open');}

function deleteReporte(id){
  if(!confirm('¿Eliminar este reporte?')) return;
  // Borrar de la cola de pendientes (si está ahí)
  savePending(getPending().filter(r=>r.id!==id));
  // Borrar de allReportes (si ya estaba sincronizado)
  allReportes=allReportes.filter(r=>r.id!==id);
  closeModalBtn(); renderReportes(); renderStats(); renderSeguimientos();
  showToast('Reporte eliminado');
}

/* ───── MODAL EDICIÓN ───── */
function abrirEdicion(id){
  const r=getReportes().find(x=>x.id===id);
  if(!r) return;
  currentEditId=id;
  editPhotoLevDataURLs=[];
  const estadoActual=r.estado||'Abierto';
  closeModalBtn();

  document.getElementById('editModalContent').innerHTML=`
    <div class="modal-title">Editar reporte</div>
    <div class="edit-info-card">
      <div><strong>Tipo:</strong> ${escapeHtml(r.tipo)}</div>
      <div><strong>Categoría:</strong> ${escapeHtml(r.categoria||'—')}</div>
      <div><strong>Jefe inmediato:</strong> ${escapeHtml(r.jefeInmediato||'—')}</div>
      <div><strong>Lugar:</strong> ${escapeHtml(r.ubicacion||'—')}</div>
      <div><strong>Descripción:</strong> ${escapeHtml((r.descripcion||'').slice(0,100))}${(r.descripcion||'').length>100?'…':''}</div>
    </div>

    <div class="form-section">
      <label class="form-label">Cambiar estado</label>
      <div class="chip-group" id="editEstadoChips">
        <div class="chip ${estadoActual==='Abierto'?'sel-abierto':''}" data-value="Abierto" onclick="selectEditEstado(this)">● Abierto</div>
        <div class="chip ${estadoActual==='Cerrado'?'sel-cerrado':''}" data-value="Cerrado" onclick="selectEditEstado(this)">● Cerrado</div>
      </div>
    </div>

    <div id="editLevantamientoSection" style="display:${estadoActual==='Cerrado'?'block':'none'};">
      <div class="form-section">
        <label class="form-label">Acciones realizadas al cierre <span class="form-required">*</span></label>
        <textarea id="editMedidasAcciones" placeholder="Describe las acciones realizadas al cierre...">${escapeHtml(r.medidasAcciones||'')}</textarea>
      </div>
    </div>

    <div class="form-section" style="margin-top:14px;">
      <label class="form-label">Firma del Editor <span class="form-required">*</span></label>
      <div style="background:var(--surface2);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;">
        <canvas id="firmaEditCanvas" width="540" height="160" style="width:100%;display:block;cursor:crosshair;background:#fff;touch-action:none;"></canvas>
      </div>
      <button type="button" onclick="limpiarFirma('firmaEditCanvas')" style="margin-top:6px;padding:6px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer;">🗑 Limpiar</button>
    </div>

    <div class="modal-actions">
      <button class="btn-close-modal" onclick="closeEditModalBtn()">Cancelar</button>
      <button class="btn-edit" onclick="guardarEdicion()">Guardar cambios</button>
    </div>
  `;
  document.getElementById('editModalOverlay').classList.add('open');
  setTimeout(()=>initFirmaCanvas('firmaEditCanvas'),100);
}

let selectedEditEstado='';
function selectEditEstado(el){
  document.querySelectorAll('#editEstadoChips .chip').forEach(c=>c.className='chip');
  selectedEditEstado=el.dataset.value;
  el.className='chip '+(selectedEditEstado==='Abierto'?'sel-abierto':'sel-cerrado');
  document.getElementById('editLevantamientoSection').style.display=selectedEditEstado==='Cerrado'?'block':'none';
}

function closeEditModal(e){if(e.target===document.getElementById('editModalOverlay')) closeEditModalBtn();}
function closeEditModalBtn(){document.getElementById('editModalOverlay').classList.remove('open');currentEditId=null;}

function guardarEdicion(){
  if(!currentEditId) return;
  const reportes=getReportes();
  const idx=reportes.findIndex(r=>r.id===currentEditId);
  if(idx<0) return;
  const r=reportes[idx];

  if(!getFirmaDataURL('firmaEditCanvas')){showToast('⚠ Dibuja tu firma para guardar');return;}
  const nuevoEstado=selectedEditEstado||r.estado||'Abierto';

  // Si va a cerrado, validar solo medidas
  if(nuevoEstado==='Cerrado'){
    const medidas=document.getElementById('editMedidasAcciones').value.trim();
    if(!medidas){
      showToast('⚠ Describe las medidas/acciones realizadas');
      return;
    }
    r.medidasAcciones=medidas;
    if(r.estado!=='Cerrado'){
      r.fechaCierre=new Date().toISOString();
    }
  } else {
    // Pasar a Abierto: limpiar datos de cierre
    if(r.estado==='Cerrado'){
      r.fechaCierre='';
    }
  }

  r.estado=nuevoEstado;
  r.firmaEdicion=getFirmaDataURL('firmaEditCanvas');
  r.synced=false;
  r.updatedAt=new Date().toISOString();

  // Actualizar en allReportes (memoria)
  const remotoIdx=allReportes.findIndex(x=>x.id===r.id);
  if(remotoIdx>=0) allReportes[remotoIdx]=r;

  // Si estaba en la cola de pendientes (aún no subido), actualizar ahí también
  const pendingQueue=getPending();
  const pendingIdx=pendingQueue.findIndex(x=>x.id===r.id);
  if(pendingIdx>=0){
    pendingQueue[pendingIdx]=r;
    savePending(pendingQueue);
    // No agregamos a pendingUpdates porque aún no se ha subido al server
  } else {
    // Ya estaba en el server: agregar a cola de updates
    const pendingUpdates=getPendingUpdates();
    pendingUpdates.push({type:'update', id:r.id, payload:r});
    savePendingUpdates(pendingUpdates);
  }

  closeEditModalBtn();
  renderReportes(); renderStats(); renderSeguimientos();
  mostrarAvisoNoRetirarse(
    navigator.onLine
      ? 'Espere hasta que el reporte se sincronice. No cierre ni salga de la aplicación.'
      : 'Cambios guardados localmente. No se retire hasta que haya internet y se complete la sincronización.'
  );
  showToast('✓ Actualizado — no se retire hasta que sincronice');
  if(navigator.onLine) autoSync();
  else actualizarAvisoPendiente();
}

/* ───── SEGUIMIENTOS ───── */
function renderSeguimientos(){
  const list=document.getElementById('seguimientosList');
  if(!list) return;

  const reportes=getReportes();
  const abiertos=reportes.filter(r=>(r.estado||'Abierto')==='Abierto');

  // Actualizar badge en tab
  const badge=document.getElementById('segBadge');
  if(abiertos.length>0){
    badge.textContent=abiertos.length;
    badge.style.display='inline-block';
  }else{
    badge.style.display='none';
  }

  // Agrupar por responsable de acción correctiva
  const porResponsable={};
  abiertos.forEach(r=>{
    const resp=String(r.responsable||'').trim();
    if(!resp) return;
    const key=resp.toLowerCase();
    if(!porResponsable[key]){
      porResponsable[key]={nombre:resp, reportes:[]};
    }
    porResponsable[key].reportes.push(r);
  });

  const grupos=Object.values(porResponsable).sort((a,b)=>b.reportes.length-a.reportes.length);

  if(!grupos.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">✓</div><h3>Sin pendientes</h3><p style="font-size:13px;">No hay reportes abiertos pendientes de levantar</p></div>`;
    return;
  }

  list.innerHTML=grupos.map(g=>`
    <div class="seg-card">
      <div class="seg-person">
        <div style="flex:1;min-width:0;">
          <div class="seg-name">${escapeHtml(g.nombre)}</div>
          <div class="seg-info">${g.reportes.length} acción${g.reportes.length>1?'es':''} correctiva${g.reportes.length>1?'s':''} pendiente${g.reportes.length>1?'s':''}</div>
        </div>
        <div>
          <div class="seg-count">${g.reportes.length}</div>
          <div class="seg-count-lbl">pendiente${g.reportes.length>1?'s':''}</div>
        </div>
      </div>
      <div class="seg-pendientes">
        ${g.reportes.map(r=>`<span class="seg-pendiente-chip" onclick="event.stopPropagation();openModal('${r.id}')" style="cursor:pointer;" title="${escapeHtml((r.descripcion||'').slice(0,80))}">${escapeHtml((r.categoria||r.tipo||'').split(' ').slice(0,3).join(' '))} — ${fmtFecha(r.fecha)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

/* ───── DESCARGAR PENDIENTES ───── */
function descargarPendientes(){
  const reportes=getReportes();
  const abiertos=reportes.filter(r=>(r.estado||'Abierto')==='Abierto');

  if(!abiertos.length){
    showToast('No hay reportes abiertos pendientes');
    return;
  }

  // Agrupar por responsable
  const porResponsable={};
  abiertos.forEach(r=>{
    const resp=String(r.responsable||'').trim()||'(Sin responsable asignado)';
    const key=resp.toLowerCase();
    if(!porResponsable[key]){ porResponsable[key]={nombre:resp, reportes:[]}; }
    porResponsable[key].reportes.push(r);
  });
  const grupos=Object.values(porResponsable).sort((a,b)=>b.reportes.length-a.reportes.length);

  const hoy=new Date();
  const fechaTxt=hoy.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const horaTxt=hoy.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false});

  const html=`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>CAMBIO DE EPPS — Pendientes — ${fechaTxt}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:24px;line-height:1.5;}
  .header{background:#1a6fd4;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;}
  .header h1{font-size:18px;font-weight:700;letter-spacing:0.02em;}
  .header p{font-size:11px;opacity:0.9;margin-top:3px;}
  .meta{background:#eef3f9;padding:10px 20px;border-bottom:2px solid #1a6fd4;font-size:11px;color:#555;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;}
  .meta strong{color:#1a2636;}
  .resumen{padding:14px 20px;background:#fff;border:1px solid #e0e6ec;border-top:none;}
  .resumen h2{font-size:13px;font-weight:600;margin-bottom:6px;color:#1a2636;text-transform:uppercase;letter-spacing:0.05em;}
  .resumen-num{display:inline-block;background:#fcebeb;color:#a32d2d;padding:2px 10px;border-radius:12px;font-weight:700;font-size:13px;margin-right:8px;}
  .grupo{background:#fff;border:1px solid #e0e6ec;border-radius:8px;margin-top:14px;overflow:hidden;page-break-inside:avoid;}
  .grupo-head{background:#f7fafd;padding:12px 16px;border-bottom:1px solid #e0e6ec;display:flex;justify-content:space-between;align-items:center;}
  .grupo-nombre{font-size:14px;font-weight:600;color:#1a2636;}
  .grupo-count{background:#a32d2d;color:#fff;padding:3px 12px;border-radius:14px;font-size:12px;font-weight:600;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  thead tr{background:#fafafa;}
  th{padding:8px 10px;text-align:left;font-weight:600;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e0e6ec;}
  td{padding:8px 10px;border-bottom:1px solid #f0f0ec;vertical-align:top;}
  tbody tr:last-child td{border-bottom:none;}
  .riesgo-alto{color:#a32d2d;font-weight:600;}
  .riesgo-medio{color:#854f0b;font-weight:600;}
  .riesgo-bajo{color:#1a9e5c;font-weight:600;}
  .footer{margin-top:24px;padding:12px 20px;font-size:10px;color:#888;border-top:2px solid #1a6fd4;text-align:right;}
  .actions{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;}
  .actions button{padding:10px 18px;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:Arial;font-weight:500;}
  .btn-print{background:#1a6fd4;color:#fff;}
  .btn-close{background:#eee;color:#333;}
  @media print{
    body{padding:12px;}
    .actions{display:none;}
    .grupo{page-break-inside:avoid;}
  }
</style>
</head><body>
<div class="header">
  <h1>CAMBIO DE EPPS — Pendientes por levantar</h1>
  <p>Minera Casma · Cambios de EPPS con acciones correctivas abiertas</p>
</div>
<div class="meta">
  <span><strong>Generado:</strong> ${fechaTxt} ${horaTxt}</span>
  <span><strong>Total pendientes:</strong> ${abiertos.length} reporte${abiertos.length>1?'s':''}</span>
  <span><strong>Responsables:</strong> ${grupos.length}</span>
</div>
<div class="resumen">
  <h2>Resumen</h2>
  ${grupos.map(g=>`<span class="resumen-num">${g.reportes.length}</span><span style="font-size:12px;margin-right:14px;">${escapeHtml(g.nombre)}</span>`).join('')}
</div>
${grupos.map(g=>{
  const filas=g.reportes.map((r,i)=>{
    const riesgoClass=r.nivelRiesgo==='Alto'?'riesgo-alto':(r.nivelRiesgo==='Medio'?'riesgo-medio':'riesgo-bajo');
    return `<tr>
      <td style="text-align:center;color:#888;">${i+1}</td>
      <td>${escapeHtml(r.fecha||'')}</td>
      <td>${escapeHtml(r.tipo||'—')}</td>
      <td>${escapeHtml(r.categoria||'—')}</td>
      <td><span class="${riesgoClass}">${escapeHtml(r.nivelRiesgo||'—')}</span></td>
      <td>${escapeHtml(r.ubicacion||'—')}</td>
      <td>${escapeHtml((r.descripcion||'').slice(0,140))}${(r.descripcion||'').length>140?'…':''}</td>
    </tr>`;
  }).join('');
  return `<div class="grupo">
    <div class="grupo-head">
      <div class="grupo-nombre">📌 ${escapeHtml(g.nombre)}</div>
      <div class="grupo-count">${g.reportes.length} pendiente${g.reportes.length>1?'s':''}</div>
    </div>
    <table>
      <thead><tr>
        <th style="width:30px;">#</th>
        <th style="width:75px;">Fecha</th>
        <th style="width:90px;">Tipo</th>
        <th style="width:120px;">Categoría</th>
        <th style="width:55px;">Riesgo</th>
        <th style="width:90px;">Ubicación</th>
        <th>Descripción</th>

      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
}).join('')}
<div class="footer">CAMBIO DE EPPS — Compañía Minera Casma SAC — Documento generado el ${fechaTxt} a las ${horaTxt}</div>
<div class="actions">
  <button class="btn-print" onclick="window.print()">🖨 Imprimir / PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
</div>
</body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  window.open(url,'_blank');
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

/* ───── ESTADÍSTICAS ───── */
let statsFiltrando = true;
let statsFiltroIniciado = false;
let pieChartInstance = null;
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function initFiltroStats(){
  const now = new Date();
  const selMes = document.getElementById('statsMes');
  const selAnio = document.getElementById('statsAnio');
  if(!selMes || !selAnio) return;
  const reportes = getReportes();
  const anios = new Set();
  reportes.forEach(r=>{
    const p=parseFechaParts(r.fecha);
    if(p) anios.add(String(p.y));
  });
  anios.add(String(now.getFullYear()));
  const prevAnio = selAnio.value;
  const prevMes = selMes.value;
  const sorted = Array.from(anios).sort().reverse();
  selAnio.innerHTML = sorted.map(a => `<option value="${a}">${a}</option>`).join('');
  if(statsFiltroIniciado && prevAnio && sorted.includes(prevAnio)){
    selAnio.value = prevAnio;
    if(prevMes) selMes.value = prevMes;
  } else {
    selMes.value = String(now.getMonth()+1);
    selAnio.value = String(now.getFullYear());
    statsFiltroIniciado = true;
  }
}

function onStatsPeriodoChange(){
  statsFiltrando = true;
  renderStats();
}

function resetFiltroStats(){
  statsFiltrando = false;
  const lbl=document.getElementById('statsPeriodoLabel');
  if(lbl) lbl.textContent = 'Mostrando: todos los cambios de EPPS';
  renderStats();
}

function getReportesDelPeriodo(){
  const todos = getReportes();
  const selMes = document.getElementById('statsMes');
  const selAnio = document.getElementById('statsAnio');
  if(!statsFiltrando || !selMes || !selAnio) return todos;
  const mes = parseInt(selMes.value,10);
  const anio = parseInt(selAnio.value,10);
  return todos.filter(r => {
    const p=parseFechaParts(r.fecha);
    return p && p.y===anio && p.m===mes;
  });
}

function getReportesFiltrados(){
  let data = getReportesDelPeriodo();
  if(filtroRiesgo) data = data.filter(r => r.nivelRiesgo === filtroRiesgo);
  if(filtroCategoria) data = data.filter(r => r.categoria === filtroCategoria);
  if(filtroTipo) data = data.filter(r => r.tipo === filtroTipo);
  if(filtroUbicacion) data = data.filter(r => areaCambioDe(r)===filtroUbicacion);
  if(filtroPersona) data = data.filter(r => personaKey(r)===filtroPersona);
  return data;
}

function areaCambioDe(r){
  return String(r.ubicacion||r.areaReportado||'').trim();
}

function personaKey(r){
  const dni=String(r.dniObservado||'').trim();
  const nom=String(r.persona||'').trim();
  if(dni) return 'dni:'+dni;
  if(nom) return 'nom:'+nom.toLowerCase();
  return '';
}

function contarPor(list, keyFn){
  const map={};
  list.forEach(r=>{
    const k=String(keyFn(r)||'').trim();
    if(!k) return;
    map[k]=(map[k]||0)+1;
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}

function rankingPersonas(list){
  const map=new Map();
  list.forEach(r=>{
    const key=personaKey(r);
    if(!key) return;
    const nom=String(r.persona||'').trim();
    const dni=String(r.dniObservado||'').trim();
    if(!map.has(key)){
      map.set(key,{key, nombre:nom||(dni?'DNI '+dni:'Sin nombre'), dni, area:String(r.areaReportado||'').trim(), count:0});
    }
    const o=map.get(key);
    o.count++;
    if(nom) o.nombre=nom;
    if(r.areaReportado) o.area=String(r.areaReportado).trim();
  });
  return [...map.values()].sort((a,b)=>b.count-a.count);
}

function filtrarPorUbicacion(val){
  const v=val||'';
  if(filtroUbicacion===v) filtroUbicacion='';
  else { filtroUbicacion=v; filtroPersona=''; filtroCategoria=''; filtroRiesgo=''; filtroTipo=''; }
  renderStats();
}

function filtrarPorPersona(val){
  const v=val||'';
  if(filtroPersona===v) filtroPersona='';
  else { filtroPersona=v; filtroUbicacion=''; filtroCategoria=''; filtroRiesgo=''; filtroTipo=''; }
  renderStats();
}

function conteoCambiosPorMes(anio){
  const counts = Array.from({length:12},()=>0);
  getReportes().forEach(r=>{
    const p=parseFechaParts(r.fecha);
    if(!p) return;
    if(anio && p.y!==anio) return;
    counts[p.m-1]++;
  });
  return counts;
}

function seleccionarMesStats(mes){
  const selMes=document.getElementById('statsMes');
  if(!selMes) return;
  statsFiltrando=true;
  selMes.value=String(mes);
  renderStats();
}

function drawPieChart(cats, total){
  const canvas = document.getElementById('statsPieChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 280, H = 280;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0,0,W,H);
  const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!sorted.length){
    ctx.fillStyle='#8a9bb0'; ctx.font='14px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Sin datos',W/2,H/2); return;
  }
  const COLORS=['#4f8ef7','#f7a84f','#4fd98e','#f74f4f','#b04fff','#4fdef7','#f7e24f','#f74fa8'];
  const cx=W/2, cy=H/2, r=110, rInner=52;
  let angle = -Math.PI/2;
  sorted.forEach(([cat,count],i)=>{
    const slice = (count/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);
    ctx.closePath();
    ctx.fillStyle=COLORS[i%COLORS.length];
    ctx.fill();
    ctx.strokeStyle='#f0f4f8'; ctx.lineWidth=2; ctx.stroke();
    if(slice > 0.25){
      const midA = angle + slice/2;
      const tx = cx + (r*0.68)*Math.cos(midA);
      const ty = cy + (r*0.68)*Math.sin(midA);
      ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(Math.round(count/total*100)+'%', tx, ty);
    }
    angle += slice;
  });
  ctx.beginPath(); ctx.arc(cx,cy,rInner,0,Math.PI*2);
  ctx.fillStyle='#f0f4f8'; ctx.fill();
  ctx.fillStyle='#1a2636'; ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(total, cx, cy-8);
  ctx.fillStyle='#4a6080'; ctx.font='11px sans-serif';
  ctx.fillText('cambios', cx, cy+12);

  const legend = document.getElementById('statsPieLegend');
  if(legend) legend.innerHTML = sorted.map(([cat,count],i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${COLORS[i%COLORS.length]};flex-shrink:0;"></div>
      <span style="color:var(--text2);flex:1;">${escapeHtml(cat)}</span>
      <span style="font-family:var(--mono);color:var(--text3);">${count} (${Math.round(count/total*100)}%)</span>
    </div>`).join('');
}

function filtrarPorTipo(tipo){
  if(filtroTipo===tipo){ filtroTipo=''; }
  else { filtroTipo=tipo; filtroRiesgo=''; filtroCategoria=''; filtroUbicacion=''; filtroPersona=''; }
  renderStats();
}

function filtrarPorRiesgo(nivel){
  if(filtroRiesgo===nivel){ filtroRiesgo=''; }
  else { filtroRiesgo=nivel; filtroCategoria=''; filtroUbicacion=''; filtroPersona=''; }
  renderStats();
}

function filtrarPorCategoria(cat){
  if(filtroCategoria===cat){ filtroCategoria=''; }
  else { filtroCategoria=cat; filtroRiesgo=''; filtroUbicacion=''; filtroPersona=''; }
  renderStats();
}

function renderStats(){
  const reportes = getReportesFiltrados();
  const selMes = document.getElementById('statsMes');
  const selAnio = document.getElementById('statsAnio');
  const anioSel = selAnio ? parseInt(selAnio.value,10) : new Date().getFullYear();
  const mesSel = selMes ? parseInt(selMes.value,10) : (new Date().getMonth()+1);

  const lbl = document.getElementById('statsPeriodoLabel');
  if(lbl){
    if(!statsFiltrando) lbl.textContent='Mostrando: todos los cambios de EPPS';
    else if(selMes && selAnio) lbl.textContent=`Mostrando: ${MESES_ES[mesSel-1]} ${selAnio.value}`;
  }
  const bannerFiltro = document.getElementById('statsFiltroActivo');
  const textoFiltro = document.getElementById('statsFiltroTexto');
  if(bannerFiltro && textoFiltro){
    if(filtroTipo){ bannerFiltro.style.display='flex'; textoFiltro.textContent='🔍 Filtrado por tipo: '+filtroTipo; }
    else if(filtroRiesgo){ bannerFiltro.style.display='flex'; textoFiltro.textContent='🔍 Filtrado por riesgo: '+filtroRiesgo; }
    else if(filtroCategoria){ bannerFiltro.style.display='flex'; textoFiltro.textContent='🔍 Filtrado por clasificación: '+filtroCategoria; }
    else if(filtroUbicacion){ bannerFiltro.style.display='flex'; textoFiltro.textContent='🔍 Filtrado por área: '+filtroUbicacion; }
    else if(filtroPersona){ bannerFiltro.style.display='flex'; textoFiltro.textContent='🔍 Filtrado por persona'; }
    else { bannerFiltro.style.display='none'; }
  }

  const total = reportes.length;
  const actos = reportes.filter(r=>r.tipo==='Acto Subestándar').length;
  const casi  = reportes.filter(r=>r.tipo==='Casi Accidente').length;
  const altos = reportes.filter(r=>r.nivelRiesgo==='Alto').length;
  const abiertos = reportes.filter(r=>(r.estado||'Abierto')==='Abierto').length;
  const cerrados = reportes.filter(r=>r.estado==='Cerrado').length;

  const hero=document.getElementById('statsHeroMes');
  if(hero){
    const todos=getReportes();
    const countsAnio=conteoCambiosPorMes(anioSel);
    const delMes=statsFiltrando?countsAnio[mesSel-1]:todos.length;
    const mesAnt=mesSel===1?12:mesSel-1;
    const anioAnt=mesSel===1?anioSel-1:anioSel;
    const countAnt=statsFiltrando
      ?(mesSel===1?conteoCambiosPorMes(anioAnt)[11]:countsAnio[mesAnt-1])
      :0;
    let deltaTxt='En tiempo real · se actualiza solo';
    if(statsFiltrando){
      const diff=delMes-countAnt;
      const signo=diff>0?'+': '';
      deltaTxt=`${signo}${diff} vs ${MESES_ES[mesAnt-1].toLowerCase()} · en tiempo real`;
    }
    const eppsHero=(statsFiltrando?getReportesDelPeriodo():todos).reduce((s,r)=>s+cantidadEppsDe(r),0);
    hero.innerHTML=`
      <div class="stats-hero">
        <div class="stats-hero-kicker">Cambio de EPPS</div>
        <div class="stats-hero-num">${eppsHero}</div>
        <div class="stats-hero-label">${statsFiltrando?`EPPS cambiados en ${MESES_ES[mesSel-1]} ${anioSel}`:'EPPS cambiados en total'}</div>
        <div class="stats-hero-sub">${delMes} registro${delMes===1?'':'s'} · ${deltaTxt}</div>
      </div>`;
  }

  const porMesEl=document.getElementById('statsPorMes');
  if(porMesEl){
    const counts=conteoCambiosPorMes(anioSel);
    const maxMes=Math.max(...counts,1);
    porMesEl.innerHTML=counts.map((n,i)=>`
      <div class="mes-bar${statsFiltrando&&(i+1)===mesSel?' is-active':''}" onclick="seleccionarMesStats(${i+1})" title="${MESES_ES[i]}: ${n} cambio${n===1?'':'s'}">
        <div class="mes-bar-count">${n}</div>
        <div class="mes-bar-track"><div class="mes-bar-fill" style="height:${Math.round(n/maxMes*100)}%;"></div></div>
        <div class="mes-bar-name">${MESES_CORTOS[i]}</div>
      </div>`).join('');
  }

  const eppsPeriodo=reportes.reduce((s,r)=>s+cantidadEppsDe(r),0);
  const hoy=new Date();
  const hoyKey=fechaKeyDia(hoy);
  const mapaDias=mapaEppsPorDia(
    statsFiltrando?anioSel:hoy.getFullYear(),
    statsFiltrando?mesSel:hoy.getMonth()+1
  );
  const eppsHoy=(mapaEppsPorDia(hoy.getFullYear(), hoy.getMonth()+1)[hoyKey]?.epps)||0;
  const diasConDato=Object.values(mapaDias);
  const eppsMes=diasConDato.reduce((s,d)=>s+d.epps,0);
  const diasDelMes=new Date(statsFiltrando?anioSel:hoy.getFullYear(), statsFiltrando?mesSel:hoy.getMonth()+1, 0).getDate();
  const promedioDia=diasConDato.length?Math.round((eppsMes/diasConDato.length)*10)/10:0;

  const hoyBox=document.getElementById('statsHoyEpps');
  if(hoyBox){
    hoyBox.innerHTML=`
      <div class="dia-resumen">
        <div class="top-card">
          <div class="top-card-kicker">Hoy</div>
          <div class="top-card-name">EPPS cambiados</div>
          <div class="top-card-meta"><span class="top-card-num">${eppsHoy}</span><span class="top-card-unit">unidad${eppsHoy===1?'':'es'}</span></div>
        </div>
        <div class="top-card">
          <div class="top-card-kicker">${statsFiltrando?MESES_ES[mesSel-1]+' '+anioSel:'Este mes'}</div>
          <div class="top-card-name">Promedio por día</div>
          <div class="top-card-meta"><span class="top-card-num">${promedioDia}</span><span class="top-card-unit">EPPS/día · ${eppsMes} en el mes</span></div>
        </div>
      </div>`;
  }

  const diaGrid=document.getElementById('statsPorDia');
  if(diaGrid){
    const yCal=statsFiltrando?anioSel:hoy.getFullYear();
    const mCal=statsFiltrando?mesSel:hoy.getMonth()+1;
    const celdas=[];
    for(let d=1;d<=diasDelMes;d++){
      const key=yCal+'-'+String(mCal).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const n=mapaDias[key]?.epps||0;
      const isToday=key===hoyKey;
      celdas.push(`<div class="dia-cell${n===0?' is-empty':''}${isToday?' is-today':''}" title="${d}/${mCal}: ${n} EPPS">
        <div class="dia-num">${d}</div>
        <div class="dia-epps">${n||'·'}</div>
      </div>`);
    }
    diaGrid.innerHTML=celdas.join('');
  }

  const grid=document.getElementById('statsGrid');
  if(grid) grid.innerHTML=`
    <div class="stat-card"><div class="stat-num">${eppsPeriodo}</div><div class="stat-label">EPPS cambiados</div></div>
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Registros</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--success)">${cerrados}</div><div class="stat-label">Cerrados</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${altos}</div><div class="stat-label">Riesgo Alto</div></div>`;

  const basePeriodo=getReportesDelPeriodo();
  const totalPeriodo=basePeriodo.length||1;
  const areasRank=contarPor(basePeriodo, areaCambioDe);
  const personasRank=rankingPersonas(basePeriodo);
  const clasifRank=contarPor(basePeriodo, r=>r.categoria);
  const topArea=areasRank[0]||null;
  const topPersona=personasRank[0]||null;
  const topClasif=clasifRank[0]||null;

  const top3=document.getElementById('statsTop3');
  if(top3){
    const card=(kicker,name,count,unit)=>`
      <div class="top-card">
        <div class="top-card-kicker">${kicker}</div>
        <div class="top-card-name">${name?escapeHtml(name):'Sin datos'}</div>
        <div class="top-card-meta">
          <span class="top-card-num">${count||0}</span>
          <span class="top-card-unit">${unit}</span>
        </div>
      </div>`;
    top3.innerHTML=
      card('Área con más cambios', topArea?topArea[0]:'', topArea?topArea[1]:0, topArea?`cambio${topArea[1]===1?'':'s'} · ${Math.round(topArea[1]/totalPeriodo*100)}%`:'del período')+
      card('Más incidencias', topPersona?topPersona.nombre:'', topPersona?topPersona.count:0, topPersona?`incidencia${topPersona.count===1?'':'s'}`:'sin persona')+
      card('Clasificación más recurrente', topClasif?topClasif[0]:'', topClasif?topClasif[1]:0, topClasif?`${Math.round(topClasif[1]/totalPeriodo*100)}% de los cambios`:'del período');
  }

  const maxArea=areasRank[0]?.[1]||1;
  const elAreas=document.getElementById('statsAreas');
  if(elAreas){
    elAreas.innerHTML=areasRank.length
      ? areasRank.slice(0,12).map(([area,count],i)=>`
        <div class="rank-row${i===0?' is-top':''}${filtroUbicacion===area?' is-active':''}" onclick="filtrarPorUbicacion(decodeURIComponent('${encodeURIComponent(area)}'))">
          <div class="rank-pos">${i+1}</div>
          <div class="rank-body">
            <div class="rank-name">${escapeHtml(area)}</div>
            <div class="rank-bar"><span style="width:${Math.round(count/maxArea*100)}%"></span></div>
          </div>
          <div class="rank-count">${count}</div>
        </div>`).join('')
      : '<p style="color:var(--text3);font-size:13px;">Sin áreas registradas en este período</p>';
  }

  const maxPer=personasRank[0]?.count||1;
  const elPers=document.getElementById('statsPersonas');
  if(elPers){
    elPers.innerHTML=personasRank.length
      ? personasRank.slice(0,12).map((p,i)=>`
        <div class="rank-row${i===0?' is-top':''}${filtroPersona===p.key?' is-active':''}" onclick="filtrarPorPersona(decodeURIComponent('${encodeURIComponent(p.key)}'))">
          <div class="rank-pos">${i+1}</div>
          <div class="rank-body">
            <div class="rank-name">${escapeHtml(p.nombre)}</div>
            <div class="rank-sub">${escapeHtml([p.dni?('DNI '+p.dni):'', p.area].filter(Boolean).join(' · ')||'Persona reportada')}</div>
            <div class="rank-bar"><span style="width:${Math.round(p.count/maxPer*100)}%"></span></div>
          </div>
          <div class="rank-count">${p.count}</div>
        </div>`).join('')
      : '<p style="color:var(--text3);font-size:13px;">Sin personas reportadas en este período</p>';
  }

  const maxCla=clasifRank[0]?.[1]||1;
  const elCla=document.getElementById('statsClasificacion');
  if(elCla){
    elCla.innerHTML=clasifRank.length
      ? clasifRank.map(([cat,count],i)=>`
        <div class="rank-row${i===0?' is-top':''}${filtroCategoria===cat?' is-active':''}" onclick="filtrarPorCategoria(decodeURIComponent('${encodeURIComponent(cat)}'))">
          <div class="rank-pos">${i+1}</div>
          <div class="rank-body">
            <div class="rank-name">${escapeHtml(cat)}${i===0?' · más recurrente':''}</div>
            <div class="rank-sub">${Math.round(count/totalPeriodo*100)}% de los cambios</div>
            <div class="rank-bar"><span style="width:${Math.round(count/maxCla*100)}%"></span></div>
          </div>
          <div class="rank-count">${count}</div>
        </div>`).join('')
      : '<p style="color:var(--text3);font-size:13px;">Sin clasificaciones en este período</p>';
  }

  // Por estado
  const maxEst=Math.max(abiertos,cerrados,1);
  const elEstado=document.getElementById('statsEstado');
  if(elEstado) elEstado.innerHTML=`
    <div style="margin-bottom:10px;padding:8px;border-radius:var(--radius-sm);">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span style="color:var(--danger);font-weight:500;">● Abierto</span>
        <span style="font-family:var(--mono);color:var(--text2);">${abiertos}</span>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${Math.round(abiertos/maxEst*100)}%;background:var(--danger);border-radius:3px;"></div></div>
    </div>
    <div style="margin-bottom:10px;padding:8px;border-radius:var(--radius-sm);">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span style="color:var(--success);font-weight:500;">● Cerrado</span>
        <span style="font-family:var(--mono);color:var(--text2);">${cerrados}</span>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${Math.round(cerrados/maxEst*100)}%;background:var(--success);border-radius:3px;"></div></div>
    </div>`;

  // Por tipo
  const tipoMap={'Acto Subestándar':['var(--danger)',actos],'Condición Subestándar':['var(--warning)',reportes.filter(r=>r.tipo==='Condición Subestándar').length],'Casi Accidente':['var(--purple)',casi]};
  const maxTipo = Math.max(...Object.values(tipoMap).map(v=>v[1]),1);
  document.getElementById('statsTipo').innerHTML = Object.entries(tipoMap).map(([tipo,[color,count]])=>`
    <div onclick="filtrarPorTipo('${tipo}')" style="margin-bottom:10px;cursor:pointer;padding:8px;border-radius:var(--radius-sm);border:1px solid ${filtroTipo===tipo?color:'transparent'};background:${filtroTipo===tipo?'rgba(255,255,255,0.04)':'transparent'};transition:all 0.2s;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;align-items:center;">
        <span style="color:${color};font-weight:500;">${tipo}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-family:var(--mono);color:var(--text2);">${count}</span>
          ${filtroTipo===tipo?`<span style="font-size:10px;background:${color};color:#fff;padding:2px 6px;border-radius:10px;font-weight:600;">filtrado</span>`:''}
        </div>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${count>0?Math.round(count/maxTipo*100):0}%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
      </div>
    </div>`
  ).join('') || '<p style="color:var(--text3);font-size:13px;">Sin datos aún</p>';

  // Por nivel de riesgo
  const riesgoMap={'Alto':['var(--danger)',altos],'Medio':['var(--warning)',reportes.filter(r=>r.nivelRiesgo==='Medio').length],'Bajo':['var(--success)',reportes.filter(r=>r.nivelRiesgo==='Bajo').length]};
  const maxRiesgo = Math.max(...Object.values(riesgoMap).map(v=>v[1]),1);
  document.getElementById('statsRiesgo').innerHTML = Object.entries(riesgoMap).map(([nivel,[color,count]])=>`
    <div onclick="filtrarPorRiesgo('${nivel}')" style="margin-bottom:10px;cursor:pointer;padding:8px;border-radius:var(--radius-sm);border:1px solid ${filtroRiesgo===nivel?color:'transparent'};background:${filtroRiesgo===nivel?'rgba(255,255,255,0.04)':'transparent'};transition:all 0.2s;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;align-items:center;">
        <span style="color:${color};font-weight:500;">● ${nivel}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-family:var(--mono);color:var(--text2);">${count}</span>
          ${filtroRiesgo===nivel?`<span style="font-size:10px;background:${color};color:#fff;padding:2px 6px;border-radius:10px;font-weight:600;">filtrado</span>`:''}
        </div>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(count/maxRiesgo*100)}%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
      </div>
    </div>`
  ).join('');

  // Por categoría (barras + torta)
  const cats={};
  reportes.forEach(r=>{if(r.categoria) cats[r.categoria]=(cats[r.categoria]||0)+1;});
  const sortedC=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const maxCat=sortedC[0]?.[1]||1;

  drawPieChart(cats, total);

  document.getElementById('statsCategoria').innerHTML=sortedC.length
    ?sortedC.map(([cat,count])=>`
      <div onclick="filtrarPorCategoria('${cat.replace(/'/g,"\\'")}')" style="margin-bottom:10px;cursor:pointer;padding:8px;border-radius:var(--radius-sm);border:1px solid ${filtroCategoria===cat?'var(--accent)':'transparent'};background:${filtroCategoria===cat?'var(--accent-dim)':'transparent'};transition:all 0.2s;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;align-items:center;">
          <span>${escapeHtml(cat)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:var(--mono);color:var(--text2);">${count}</span>
            ${filtroCategoria===cat?'<span style="font-size:10px;background:var(--accent);color:#fff;padding:2px 6px;border-radius:10px;font-weight:600;">filtrado</span>':''}
          </div>
        </div>
        <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(count/maxCat*100)}%;background:var(--accent);border-radius:3px;"></div>
        </div>
      </div>`).join('')
    :`<p style="color:var(--text3);font-size:13px;">Sin datos de categoría aún</p>`;

  const pendingCount=getPending().length+getPendingUpdates().length;
  const catEl=document.getElementById('statsCategoria');
  if(pendingCount>0 && catEl) catEl.innerHTML+=
    `<div style="margin-top:16px;padding:12px;background:var(--warning-dim);border-radius:var(--radius-sm);font-size:13px;color:var(--warning);">
      ⏳ ${pendingCount} cambio${pendingCount>1?'s':''} pendiente${pendingCount>1?'s':''} de sincronizar
    </div>`;
  updateLiveStamp();
}

/* ───── SINCRONIZACIÓN ───── */
let isSyncing=false;

function hayPendientesSync(){
  return getPending().length+getPendingUpdates().length>0;
}

function mostrarAvisoNoRetirarse(mensaje){
  const overlay=document.getElementById('syncStayOverlay');
  const msg=document.getElementById('syncStayMsg');
  if(msg && mensaje) msg.textContent=mensaje;
  if(overlay) overlay.hidden=false;
  clearTimeout(mostrarAvisoNoRetirarse._t);
  if(!isSyncing){
    mostrarAvisoNoRetirarse._t=setTimeout(()=>{
      if(!isSyncing){
        ocultarAvisoNoRetirarse();
        actualizarAvisoPendiente();
      }
    },7000);
  }
}

function ocultarAvisoNoRetirarse(){
  const overlay=document.getElementById('syncStayOverlay');
  if(overlay) overlay.hidden=true;
  clearTimeout(mostrarAvisoNoRetirarse._t);
}

function actualizarAvisoPendiente(){
  const pendingBanner=document.getElementById('pendingStayBanner');
  const overlay=document.getElementById('syncStayOverlay');
  const overlayVisible=overlay && !overlay.hidden;
  if(pendingBanner){
    pendingBanner.classList.toggle('show', hayPendientesSync() && !isSyncing && !overlayVisible);
  }
}

window.addEventListener('beforeunload', function(e){
  if(isSyncing || hayPendientesSync()){
    e.preventDefault();
    e.returnValue='Hay reportes sin sincronizar. No se retire hasta que sincronice.';
  }
});

document.addEventListener('click', function(e){
  const overlay=document.getElementById('syncStayOverlay');
  if(!overlay || overlay.hidden || isSyncing) return;
  if(e.target===overlay){
    ocultarAvisoNoRetirarse();
    actualizarAvisoPendiente();
  }
});

function updateSyncUI(){
  const online=navigator.onLine;
  const pending=getPending().length+getPendingUpdates().length; // solo colas, no allReportes
  const dot=document.getElementById('syncDot'), label=document.getElementById('syncLabel');
  document.getElementById('offlineBanner').classList.toggle('show',!online);
  if(!online){dot.className='sync-dot';label.textContent='offline';}
  else if(isSyncing){dot.className='sync-dot syncing';label.textContent='sincronizando';}
  else if(pending){dot.className='sync-dot pending';label.textContent=pending+' pend.';}
  else{dot.className='sync-dot online';label.textContent='online';}
  const liveDot=document.getElementById('statsLiveDot');
  if(liveDot) liveDot.classList.toggle('is-offline', !online);
  actualizarAvisoPendiente();
}

/* ───── ESTADÍSTICAS EN TIEMPO REAL ───── */
let liveStatsTimer=null;
let liveFetchInFlight=false;
const LIVE_POLL_MS=25000;

function updateLiveStamp(){
  const el=document.getElementById('statsLiveStamp');
  if(!el) return;
  const t=new Date();
  const hora=t.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  el.textContent=navigator.onLine
    ? 'Actualizado '+hora
    : 'Sin conexión · '+hora;
}

function startLiveStats(){
  stopLiveStats();
  liveStatsTimer=setInterval(()=>{
    if(navigator.onLine) refrescarDatosEnVivo();
    else updateLiveStamp();
  }, LIVE_POLL_MS);
}

function stopLiveStats(){
  if(liveStatsTimer){ clearInterval(liveStatsTimer); liveStatsTimer=null; }
}

async function refrescarDatosEnVivo(){
  if(liveFetchInFlight || !navigator.onLine) return;
  if(document.getElementById('syncBanner')?.classList.contains('show')) return;
  liveFetchInFlight=true;
  try{
    const res=await fetch(SHEETS_URL+'?action=reportes',{mode:'cors'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const json=await res.json();
    if(!json.ok) throw new Error(json.error||'Error del servidor');
    const remotos=json.reportes||[];
    const pendingIds=new Set(getPending().map(r=>String(r.id)));
    allReportes=remotos.filter(r=>!pendingIds.has(String(r.id)));
    serverLoaded=true;
    initFiltroStats();
    renderReportes();
    renderStats();
    renderSeguimientos();
    const info=document.getElementById('serverSyncInfo');
    const total=getReportes().length;
    const pendientes=getPending().length;
    if(info) info.textContent=total+' cambios'+(pendientes?' ('+pendientes+' por sincronizar)':'');
    updateLiveStamp();
    if(getPending().length||getPendingUpdates().length) autoSync();
  }catch(err){
    console.error('Refresh en vivo:', err);
    updateLiveStamp();
  }finally{
    liveFetchInFlight=false;
  }
}

async function autoSync(){
  if(!navigator.onLine) return;
  if(isSyncing) return;
  const pending=getPending();
  const pendingUpdates=getPendingUpdates();
  if(!pending.length && !pendingUpdates.length) return;

  isSyncing=true;
  clearTimeout(mostrarAvisoNoRetirarse._t);
  document.getElementById('syncDot').className='sync-dot syncing';
  document.getElementById('syncLabel').textContent='sincronizando';
  document.getElementById('syncBanner').classList.add('show');
  mostrarAvisoNoRetirarse('Espere hasta que el reporte se sincronice. No cierre ni salga de la aplicación.');
  actualizarAvisoPendiente();

  // ── 1) Sincronizar reportes nuevos ──
  // pending ahora contiene objetos completos (no solo IDs)
  const sincronizados=[];

  for(const r of pending){
    try {
      // ── CADA evidencia → archivo en Google Drive (solo se guarda el link en Sheet) ──
      const links=[];
      // Conservar links de Drive ya subidos en un intento anterior
      for(const prev of (r.linksFotos||[])){
        if(esLinkDrive(prev)) links.push(prev);
      }
      for(let i=0;i<(r.fotos||[]).length;i++){
        const item=r.fotos[i];
        if(esLinkDrive(item)){ links.push(item); continue; }
        if(!esDataUrl(item)) continue;
        const link=await subirEvidenciaADrive(item, `hallazgo${i+1}`, 'hallazgo', r.id);
        if(link) links.push(link);
        else throw new Error('No se pudo subir foto de hallazgo '+(i+1)+' a Google Drive');
      }
      r.linksFotos=links;
      r.fotos=[];

      // Fotos de entrega → Drive
      const linksEntrega=[];
      for(const prev of (r.linksFotosEntrega||[])){
        if(esLinkDrive(prev)) linksEntrega.push(prev);
      }
      for(let i=0;i<(r.fotosEntrega||[]).length;i++){
        const item=r.fotosEntrega[i];
        if(esLinkDrive(item)){ linksEntrega.push(item); continue; }
        if(!esDataUrl(item)) continue;
        const link=await subirEvidenciaADrive(item, `entrega${i+1}`, 'entrega', r.id);
        if(link) linksEntrega.push(link);
        else throw new Error('No se pudo subir foto del personal '+(i+1)+' a Google Drive');
      }
      r.linksFotosEntrega=linksEntrega;
      r.fotosEntrega=[];

      // Firma de registro → Drive
      if(esDataUrl(r.firmaRegistro)){
        const lf=await subirEvidenciaADrive(r.firmaRegistro, 'firma_reg', 'firma', r.id);
        if(lf){
          r.firmaRegistro=lf;
          console.log('Firma registro en Drive:', lf);
        } else {
          throw new Error('No se pudo subir la firma a Google Drive');
        }
      }

      // Fotos de cierre → Drive
      const linksLev=[];
      for(const prev of (r.linksFotosLevantamiento||[])){
        if(esLinkDrive(prev)) linksLev.push(prev);
      }
      for(let i=0;i<(r.fotosLevantamiento||[]).length;i++){
        const item=r.fotosLevantamiento[i];
        if(esLinkDrive(item)){ linksLev.push(item); continue; }
        if(!esDataUrl(item)) continue;
        const link=await subirEvidenciaADrive(item, `cierre${i+1}`, 'cierre', r.id);
        if(link) linksLev.push(link);
        else throw new Error('No se pudo subir foto de cierre '+(i+1)+' a Google Drive');
      }
      r.linksFotosLevantamiento=linksLev;
      r.fotosLevantamiento=[];

      // Payload limpio: sin base64, solo enlaces Drive
      const payload={
        ...r,
        fotos:[],
        fotosEntrega:[],
        fotosLevantamiento:[],
        linksFotos:r.linksFotos,
        linksFotosEntrega:r.linksFotosEntrega,
        linksFotosLevantamiento:r.linksFotosLevantamiento
      };

      const res=await fetch(SHEETS_URL,{
        method:'POST', mode:'cors',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({type:'reporte',data:[payload]})
      });
      if(!res.ok) throw new Error('HTTP '+res.status);

      // Subido OK: mover a allReportes y sacar de la cola
      r.synced=true;
      allReportes.unshift(r);
      sincronizados.push(r.id);
    } catch(err) {
      console.error('Error subiendo reporte:', err);
      isSyncing=false;
      document.getElementById('syncBanner').classList.remove('show');
      mostrarAvisoNoRetirarse('No se pudo sincronizar. No se retire: el reporte sigue pendiente y se reintentará.');
      updateSyncUI();
      showToast(err.message&&err.message.indexOf('Drive')>=0
        ? '⚠ '+err.message+' — no se retire hasta que sincronice'
        : '⚠ Error al subir evidencias. No se retire: se reintentará');
      // Guardar estado parcial (links Drive ya subidos se conservan)
      savePending(pending.filter(x=>!sincronizados.includes(x.id)));
      return;
    }
  }

  // Eliminar de la cola los que se subieron exitosamente
  if(sincronizados.length){
    savePending(pending.filter(r=>!sincronizados.includes(r.id)));
  }

  // ── 2) Sincronizar updates ──
  const remainingUpdates=[];
  for(const upd of pendingUpdates){
    try {
      if(upd.type==='update'){
        const r=upd.payload;
        // Cada evidencia nueva del update → Google Drive
        if(r.fotosLevantamiento && r.fotosLevantamiento.length){
          const linksLev=Array.isArray(r.linksFotosLevantamiento)?[...r.linksFotosLevantamiento]:[];
          for(let i=0;i<r.fotosLevantamiento.length;i++){
            const item=r.fotosLevantamiento[i];
            if(esLinkDrive(item)){ linksLev.push(item); continue; }
            if(!esDataUrl(item)) continue;
            const link=await subirEvidenciaADrive(item, `cierre_edit${i+1}`, 'cierre', r.id);
            if(link) linksLev.push(link);
            else throw new Error('No se pudo subir foto de cierre a Google Drive');
          }
          r.linksFotosLevantamiento=linksLev;
          r.fotosLevantamiento=[];
        }
        if(esDataUrl(r.firmaEdicion)){
          const lfe=await subirEvidenciaADrive(r.firmaEdicion,'firma_edit','firma', r.id);
          if(lfe) r.firmaEdicion=lfe;
          else throw new Error('No se pudo subir firma de edición a Google Drive');
        }
        const res=await fetch(SHEETS_URL,{
          method:'POST', mode:'cors',
          headers:{'Content-Type':'text/plain'},
          body:JSON.stringify({type:'update', id:r.id, data:{...r, fotos:[], fotosEntrega:[], fotosLevantamiento:[]}})
        });
        if(res.ok){
          // Actualizar en memoria
          const idx=allReportes.findIndex(x=>x.id===r.id);
          if(idx>=0){ allReportes[idx]={...allReportes[idx],...r,synced:true}; }
        } else {
          remainingUpdates.push(upd);
        }
      } else if(upd.type==='personal_add'){
        const res=await fetch(SHEETS_URL,{
          method:'POST', mode:'cors',
          headers:{'Content-Type':'text/plain'},
          body:JSON.stringify({type:'personal', data:upd.payload})
        });
        if(!res.ok) remainingUpdates.push(upd);
      }
    } catch(err) {
      console.error('Error en update:', err);
      remainingUpdates.push(upd);
    }
  }
  savePendingUpdates(remainingUpdates);

  isSyncing=false;
  document.getElementById('syncBanner').classList.remove('show');
  const quedaPendiente=hayPendientesSync();
  if(quedaPendiente){
    mostrarAvisoNoRetirarse('Aún hay reportes sin sincronizar. No se retire hasta que el envío se complete.');
  } else {
    ocultarAvisoNoRetirarse();
  }
  updateSyncUI();
  renderReportes();
  renderStats();
  renderSeguimientos();

  const totalSync=sincronizados.length+(pendingUpdates.length-remainingUpdates.length);
  if(totalSync>0 && !quedaPendiente){
    showToast(`✓ ${totalSync} cambio${totalSync>1?'s':''} sincronizado${totalSync>1?'s':''}. Ya puede retirarse.`);
  } else if(totalSync>0){
    showToast(`✓ ${totalSync} sincronizado${totalSync>1?'s':''}. No se retire: aún hay pendientes.`);
  }
}

/** true si ya es un enlace de Google Drive (evidencia ya en la nube) */
function esLinkDrive(u){
  if(!u||typeof u!=='string') return false;
  if(u.startsWith('data:')) return false;
  return /drive\.google\.com|googleusercontent\.com|docs\.google\.com/.test(u) || /^https?:\/\//i.test(u);
}
function esDataUrl(u){
  return !!(u && typeof u==='string' && u.startsWith('data:'));
}

/**
 * Sube UNA evidencia a Google Drive vía Apps Script.
 * tipoEvidencia: 'hallazgo' | 'entrega' | 'cierre' | 'firma'
 * Devuelve la URL de Drive o null.
 */
async function subirEvidenciaADrive(dataURL, nombreBase, tipoEvidencia, reporteId){
  if(esLinkDrive(dataURL)) return dataURL;
  if(!esDataUrl(dataURL)) return null;
  try{
    const mime=dataURL.split(';')[0].split(':')[1]||'image/jpeg';
    const base64=dataURL.split(',')[1];
    if(!base64) return null;
    const ext=(mime.split('/')[1]||'jpg').replace('jpeg','jpg');
    const nombreArchivo=`${nombreBase}.${ext}`;
    const tipoPost=tipoEvidencia==='firma'?'firma':'foto';
    const res=await fetch(SHEETS_URL,{
      method:'POST', mode:'cors',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({
        type: tipoPost,
        tipoEvidencia: tipoEvidencia||'hallazgo',
        reporteId: reporteId||'',
        nombre: nombreArchivo,
        mime,
        data: base64
      })
    });
    if(res.ok){
      const json=await res.json();
      if(json.ok && json.url){
        console.log('✓ Evidencia en Drive ['+tipoEvidencia+']:', json.url);
        return json.url;
      }
      console.warn('Drive sin URL:', json);
    } else {
      console.error('HTTP al subir evidencia:', res.status);
    }
  }catch(e){console.error('❌ Error subiendo evidencia a Drive:', e);}
  return null;
}

/** @deprecated usar subirEvidenciaADrive — se mantiene por compatibilidad */
async function subirFoto(dataURL, nombre){
  return subirEvidenciaADrive(dataURL, nombre, 'hallazgo', '');
}

/* ───── CARGA DESDE SERVIDOR ───── */
// silencioso=true cuando se llama al arrancar (no muestra toast de "ya sincronizado")
async function cargarDelServidor(silencioso=false){
  const btn=document.getElementById('btnCargarServidor');
  const info=document.getElementById('serverSyncInfo');
  if(!navigator.onLine){
    if(!silencioso) showToast('Sin conexión a internet');
    if(info) info.textContent='Sin conexión — mostrando '+getPending().length+' pendiente(s) local(es)';
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='Cargando...'; }
  if(info) info.textContent='Cargando del servidor...';
  try{
    const res=await fetch(SHEETS_URL+'?action=reportes',{mode:'cors'});
    if(!res.ok) throw new Error('Error HTTP '+res.status);
    const json=await res.json();
    if(!json.ok) throw new Error(json.error||'Error del servidor');

    const remotos=json.reportes||[];

    // Los IDs de pendientes locales para no pisarlos con la versión del server
    const pendingIds=new Set(getPending().map(r=>String(r.id)));
    // Cargar en memoria — excluir los que están en la cola local (tienen versión más nueva)
    allReportes=remotos.filter(r=>!pendingIds.has(String(r.id)));
    serverLoaded=true;

    initFiltroStats();
    renderReportes();
    renderStats();
    renderSeguimientos();

    const total=getReportes().length;
    const pendientes=getPending().length;
    if(info) info.textContent=total+' cambios'+(pendientes?' ('+pendientes+' por sincronizar)':'');
    if(!silencioso) showToast('✓ '+total+' cambios de EPPS cargados');

    // Aprovechar para sincronizar pendientes si los hay
    if(getPending().length||getPendingUpdates().length) autoSync();
  }catch(err){
    if(info) info.textContent='Error al cargar del servidor';
    if(!silencioso) showToast('Error: '+err.message);
    console.error(err);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='↓ Recargar'; }
  }
}

function manualSync(){
  if(!navigator.onLine){showToast('Sin conexión a internet');return;}
  cargarPersonal();
  cargarDelServidor(false);
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

/* ───── CAUSA PROBABLE ───── */
const CAUSAS_PROBABLES=[
  'Capacidad física / fisiológica inadecuada','Capacidad mental / psicológica inadecuada',
  'Estrés físico o fisiológico','Estrés mental o psicológico','Falta de conocimientos',
  'Falta de habilidad','Motivación inapropiada','Liderazgo y/o supervisión inadecuada',
  'Ingeniería inadecuada','Compras inadecuadas','Mantenimiento inadecuado',
  'Herramientas / Equipos / Materiales inadecuados','Estándares de trabajo inadecuado',
  'Uso / Desgaste excesivo','Abuso o mal uso'
];
let causaSeleccionadaValor='';
function filtrarCausaProbable(){
  const q=(document.getElementById('causaProbableSearch').value||'').toLowerCase().trim();
  const dd=document.getElementById('causaDropdown');
  const filtered=q?CAUSAS_PROBABLES.filter(c=>c.toLowerCase().includes(q)):CAUSAS_PROBABLES;
  dd.innerHTML=filtered.map(c=>`<div onclick="seleccionarCausa(this)" data-val="${escapeHtml(c)}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${escapeHtml(c)}</div>`).join('');
  dd.style.display=filtered.length?'block':'none';
}
function seleccionarCausa(el){
  causaSeleccionadaValor=el.dataset.val;
  document.getElementById('causaProbableSearch').value=causaSeleccionadaValor;
  document.getElementById('causaDropdown').style.display='none';
  const s=document.getElementById('causaSeleccionada');s.textContent='✓ '+causaSeleccionadaValor;s.style.display='block';
}
document.addEventListener('click',e=>{
  const dd=document.getElementById('causaDropdown'),inp=document.getElementById('causaProbableSearch');
  if(dd && inp && !dd.contains(e.target) && e.target!==inp) dd.style.display='none';
});

/* ───── FIRMA DIGITAL ───── */
function initFirmaCanvas(id){
  const c=document.getElementById(id);if(!c)return;
  c.style.touchAction='none';
  const ctx=c.getContext('2d');ctx.strokeStyle='#1a2636';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  c._hasData=false;c._drawing=false;
  const pos=e=>{const r=c.getBoundingClientRect(),sx=c.width/r.width,sy=c.height/r.height,s=e.touches?e.touches[0]:e;return{x:(s.clientX-r.left)*sx,y:(s.clientY-r.top)*sy};};
  const start=e=>{e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);c._drawing=true;c._hasData=true;};
  const move=e=>{e.preventDefault();if(!c._drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();};
  const end=e=>{e.preventDefault();c._drawing=false;};
  c.addEventListener('mousedown',start);c.addEventListener('mousemove',move);c.addEventListener('mouseup',end);c.addEventListener('mouseleave',end);
  c.addEventListener('touchstart',start,{passive:false});c.addEventListener('touchmove',move,{passive:false});c.addEventListener('touchend',end,{passive:false});
}
function limpiarFirma(id){const c=document.getElementById(id);if(!c)return;c.getContext('2d').clearRect(0,0,c.width,c.height);c._hasData=false;}
function getFirmaDataURL(id){const c=document.getElementById(id);return(c&&c._hasData)?c.toDataURL('image/png'):null;}
async function subirFirma(dataURL,nombre){
  // Cada firma se guarda como archivo en Google Drive
  return subirEvidenciaADrive(dataURL, nombre||'firma', 'firma', '');
}
window.addEventListener('load',()=>{initFirmaCanvas('firmaCanvas');});

/* ───── VALE PDF ───── */
const LOGO_DATA='data:image/jpeg;base64,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';
function generarVale(id){
  const r=getReportes().find(x=>x.id===id);if(!r){showToast('No encontrado');return;}
  console.log('[Vale] firmaRegistro:', r.firmaRegistro?.substring(0,80), '| firmaEdicion:', r.firmaEdicion?.substring(0,80));
  closeModalBtn();
  const fH=toArray(r.fotos).length?toArray(r.fotos):toArray(r.linksFotos);
  const fE=toArray(r.fotosEntrega).length?toArray(r.fotosEntrega):toArray(r.linksFotosEntrega);
  const fL=toArray(r.fotosLevantamiento).length?toArray(r.fotosLevantamiento):toArray(r.linksFotosLevantamiento);
  const fd=f=>{if(!f)return'—';try{return new Date(f).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return f;}};
  const imgs=(u,t)=>u.length?`<div style="margin-top:10px;"><b style="font-size:10px;text-transform:uppercase;color:#666;">${t}</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">${u.map(x=>{const gid=(x.match(/[?&]id=([\w-]+)/)||x.match(/\/d\/([\w-]+)/))?.[1];const src=gid?'https://lh3.googleusercontent.com/d/'+gid:x;return'<img src="'+src+'" style="width:140px;height:100px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" onerror="this.style.display=\'none\'">';}).join('')}</div></div>`:'';
  const firmaThumb=u=>{if(!u||u==='null'||u.trim()==='')return'';if(u.startsWith('data:'))return u;const m=u.match(/[?&]id=([\w-]+)/)||u.match(/\/d\/([\w-]+)/);return m?'https://lh3.googleusercontent.com/d/'+m[1]+'=w300':u;};
  const fsig=(url,lbl)=>{const src=firmaThumb(url);return src?'<div style="margin-top:6px;"><div style="font-size:9px;color:#888;margin-bottom:4px;">'+lbl+'</div><img src="'+src+'" style="max-height:70px;max-width:220px;object-fit:contain;border-bottom:2px solid #333;display:block;" onerror="this.style.display=\'none\'"></div>':'<div style="margin-top:6px;height:70px;border-bottom:2px solid #333;"></div><div style="font-size:9px;color:#888;margin-top:4px;">'+lbl+'</div>';};
  const logo=logoPrintSrc();
  const h=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CAMBIO DE EPPS ${r.id}</title>
  <style>body{font:12px/1.5 Arial,sans-serif;margin:0;padding:20px;max-width:800px;margin:0 auto;color:#1a1a1a;}
  .hdr{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a2636;padding-bottom:10px;margin-bottom:14px;}
  .hdr img{width:70px;height:70px;object-fit:contain;}.hdr h1{font-size:15px;margin:0;color:#1a2636;}.hdr p{font-size:9px;color:#666;margin:0;}
  .stamp{display:inline-block;background:#1a2636;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.14em;padding:5px 12px;margin-top:6px;}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;}td{padding:4px 6px;border:1px solid #ddd;vertical-align:top;}
  .lbl{background:#f0f4f8;font-weight:600;font-size:10px;color:#444;text-transform:uppercase;width:28%;}
  .firmas{display:flex;gap:30px;margin-top:20px;border-top:1px solid #ddd;padding-top:14px;}
  .fb{flex:1;text-align:center;}
  @media print{body{padding:10px;}button{display:none!important;}}</style></head><body>
  <div class="hdr"><img src="${logo}"><div style="flex:1;"><h1>COMPAÑÍA MINERA CASMA SAC</h1><p>RUC: 20606447192</p><div class="stamp">CAMBIO DE EPPS</div></div>
  <div style="text-align:right;"><div style="font-size:16px;font-weight:700;font-family:monospace;color:#1a2636;">#${r.id}</div><div style="font-size:9px;color:#888;">${new Date().toLocaleDateString('es-PE')}</div></div></div>
  <table>
  <tr><td class="lbl">Estado</td><td style="color:${r.estado==='Cerrado'?'#1a9e5c':'#d63b3b'};font-weight:600;">● ${r.estado||'Abierto'}</td><td class="lbl">Riesgo</td><td>${r.nivelRiesgo||'—'}</td></tr>
  <tr><td class="lbl">Tipo</td><td>${r.tipo||'—'}</td><td class="lbl">Fecha/Hora</td><td>${fd(r.fecha)} ${r.hora||''}</td></tr>
  <tr><td class="lbl">Categoría</td><td>${r.categoria||'—'}</td><td class="lbl">EPPS cambiados</td><td>${cantidadEppsDe(r)}</td></tr>
  
  <tr><td class="lbl">Descripción</td><td colspan="3" style="white-space:pre-wrap;">${escapeHtml(r.descripcion||'—')}</td></tr>
  <tr><td class="lbl">Ubicación</td><td colspan="3">${r.ubicacion||'—'}</td></tr>
  <tr><td class="lbl">Responsable</td><td>${r.responsable||'—'}</td><td class="lbl">Persona Reportada</td><td>${r.persona||'—'}</td></tr>
  <tr><td class="lbl">Jefe inmediato</td><td colspan="3">${escapeHtml(r.jefeInmediato||'—')}</td></tr>
  <tr><td class="lbl">Reportante</td><td colspan="3">${r.reportador||REPORTANTE_DEFAULT}</td></tr>
  </table>
  ${r.estado==='Cerrado'?`<table><tr><td class="lbl">Fecha Cierre</td><td>${fd(r.fechaCierre)}</td><td class="lbl">Medidas</td><td style="white-space:pre-wrap;">${escapeHtml(r.medidasAcciones||'—')}</td></tr></table>`:''}
  ${imgs(fH,'Fotos del Hallazgo')}${fE.length?imgs(fE,'Fotos del Personal'):''}${fL.length?imgs(fL,'Fotos de Cierre'):''}
  <div class="firmas"><div class="fb">${fsig(r.firmaRegistro,'Firma Registrador')}<div style="font-size:9px;color:#555;margin-top:2px;">${r.reportador||REPORTANTE_DEFAULT}</div></div>
  ${r.firmaEdicion&&r.firmaEdicion!=='null'?`<div class="fb">${fsig(r.firmaEdicion,'Firma Editor')}</div>`:''}</div>
  <div style="text-align:center;margin-top:20px;font-size:8px;color:#aaa;border-top:1px solid #eee;padding-top:6px;">CAMBIO DE EPPS — Compañía Minera Casma SAC — RUC 20606447192</div>
  <script>window.onload=()=>{const imgs=document.querySelectorAll("img");if(!imgs.length){setTimeout(()=>window.print(),500);return;}let loaded=0;const total=imgs.length;const tryPrint=()=>{loaded++;if(loaded>=total)setTimeout(()=>window.print(),300);};imgs.forEach(img=>{if(img.complete){tryPrint();}else{img.onload=tryPrint;img.onerror=tryPrint;}});setTimeout(()=>window.print(),6000);};<\/script></body></html>`;
  const w=window.open('','_blank');w.document.write(h);w.document.close();
}

/* ───── EXPORTAR PDF ───── */
function exportarPDF(){
  const data=getReportes();if(!data.length){showToast('No hay reportes');return;}
  const fd=f=>{if(!f)return'';try{return new Date(f).toLocaleDateString('es-PE');}catch{return f;}};
  const driveThumb=u=>{const gid=(u.match(/[?&]id=([\w-]+)/)||u.match(/\/d\/([\w-]+)/))?.[1];return gid?'https://lh3.googleusercontent.com/d/'+gid+'=w120':u;};
  const firmThumb=u=>{if(!u||u==='null'||u.startsWith('data:'))return'';const gid=(u.match(/[?&]id=([\w-]+)/)||u.match(/\/d\/([\w-]+)/))?.[1];return gid?'https://lh3.googleusercontent.com/d/'+gid+'=w300':u;};
  let rows='';
  data.forEach(r=>{
    const fH=toArray(r.fotos).length?toArray(r.fotos):toArray(r.linksFotos);
    const fE=toArray(r.fotosEntrega).length?toArray(r.fotosEntrega):toArray(r.linksFotosEntrega);
    const fL=toArray(r.fotosLevantamiento).length?toArray(r.fotosLevantamiento):toArray(r.linksFotosLevantamiento);
    const ic=u=>u.slice(0,2).map(x=>'<img src="'+driveThumb(x)+'" style="width:65px;height:48px;object-fit:cover;border-radius:3px;margin:1px;" onerror="this.style.display=\'none\'">').join('');
    const e=r.estado||'Abierto';
    const firmaImg=firmThumb(r.firmaRegistro);
    const rep=escapeHtml(r.reportador||REPORTANTE_DEFAULT);
    rows+=`<tr><td style="font-family:monospace;text-align:center;">${r.id}</td><td>${fd(r.fecha)}</td><td>${r.hora||''}</td><td>${r.tipo||''}</td><td>${r.ubicacion||''}</td><td>${r.nivelRiesgo||''}</td><td style="max-width:170px;white-space:pre-wrap;">${escapeHtml((r.descripcion||'').slice(0,200))}</td><td>${ic(fH)}</td><td>${ic(fE)}</td><td style="max-width:140px;white-space:pre-wrap;">${escapeHtml((r.medidasAcciones||'').slice(0,150))}</td><td>${ic(fL)}</td><td style="color:${e==='Cerrado'?'#1a9e5c':'#d63b3b'};font-weight:600;">● ${e}</td><td>${rep}</td><td style="text-align:center;min-width:90px;">${firmaImg?'<img src="'+firmaImg+'" style="height:45px;max-width:90px;object-fit:contain;" onerror="this.style.display=\'none\'"><div style="font-size:7px;color:#555;margin-top:2px;border-top:1px solid #ccc;">'+rep+'</div>':'<span style="font-size:7px;color:#ccc;">Sin firma</span>'}</td></tr>`;
  });
  const logo=logoPrintSrc();
  const h=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CAMBIO DE EPPS</title><style>body{font:9px/1.4 Arial,sans-serif;margin:14px;}.hdr{display:flex;align-items:center;gap:10px;border-bottom:2px solid #1a2636;padding-bottom:8px;margin-bottom:10px;}.hdr img{width:55px;height:55px;object-fit:contain;}h1{font-size:12px;color:#1a2636;margin:0;}h2{font-size:9px;color:#555;margin:0;font-weight:normal;}.stamp{display:inline-block;background:#1a2636;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.14em;padding:3px 8px;margin:4px 0;}table{width:100%;border-collapse:collapse;}th{background:#1a2636;color:#fff;padding:4px 3px;text-align:left;font-size:8px;text-transform:uppercase;white-space:nowrap;}td{padding:3px;border:1px solid #ddd;vertical-align:top;font-size:8px;}tr:nth-child(even){background:#f8f9fb;}@media print{body{margin:6px;}@page{size:A3 landscape;margin:8mm;}}</style></head><body>
  <div class="hdr"><img src="${logo}"><div><h1>COMPAÑÍA MINERA CASMA SAC</h1><div class="stamp">CAMBIO DE EPPS</div><h2>RUC: 20606447192 — Total: ${data.length} cambios | Generado: ${new Date().toLocaleDateString('es-PE')}</h2></div></div>
  <table><thead><tr><th>ID</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Lugar</th><th>Riesgo</th><th>Descripción del Hallazgo</th><th>Foto hallazgo</th><th>Foto personal</th><th>Medidas Correctivas</th><th>Foto lev.</th><th>Estado</th><th>Reportante</th><th style="min-width:90px;">Firma Registrador</th></tr></thead><tbody>${rows}</tbody></table>
  <div style="text-align:center;margin-top:10px;font-size:7px;color:#aaa;">CAMBIO DE EPPS — Compañía Minera Casma SAC — RUC 20606447192</div>
  <script>window.onload=()=>{const imgs=document.querySelectorAll("img");if(!imgs.length){setTimeout(()=>window.print(),500);return;}let loaded=0;const total=imgs.length;const tryPrint=()=>{loaded++;if(loaded>=total)setTimeout(()=>window.print(),300);};imgs.forEach(img=>{if(img.complete){tryPrint();}else{img.onload=tryPrint;img.onerror=tryPrint;}});setTimeout(()=>window.print(),6000);};<\/script></body></html>`;
  const w=window.open('','_blank');w.document.write(h);w.document.close();
}

/* ───── EXPORTAR EXCEL ───── */
async function exportarExcel(){
  showToast('Generando Excel...');
  const data=getReportes();if(!data.length){showToast('No hay reportes');return;}
  if(!window.XLSX){await new Promise((r,j)=>{const s=document.createElement('script');s.src=EXCEL.cdn;s.onload=r;s.onerror=j;document.head.appendChild(s);});}
  const fd=f=>{if(!f)return'';try{return new Date(f).toLocaleDateString('es-PE');}catch{return f;}};
  const did=u=>{const m=u.match(/[?&]id=([\w-]+)/)||u.match(/\/d\/([\w-]+)/);return m?'https://lh3.googleusercontent.com/d/'+m[1]:u;};
  const ws_data=[['ID','Fecha','Hora','Tipo','Ubicación','Riesgo','Categoría','EPPS cambiados','Descripción','Fotos Hallazgo','Fotos del Personal','Estado','Fotos Levantamiento','Medidas/Acciones','Reportador','Jefe inmediato','Persona Obs.','DNI Obs.','Fecha Cierre']];
  data.forEach(r=>{
    const fH=toArray(r.fotos).length?toArray(r.fotos):toArray(r.linksFotos);
    const fE=toArray(r.fotosEntrega).length?toArray(r.fotosEntrega):toArray(r.linksFotosEntrega);
    const fL=toArray(r.fotosLevantamiento).length?toArray(r.fotosLevantamiento):toArray(r.linksFotosLevantamiento);
    ws_data.push([r.id||'',fd(r.fecha),r.hora||'',r.tipo||'',r.ubicacion||'',r.nivelRiesgo||'',r.categoria||'',cantidadEppsDe(r),r.descripcion||'',fH.map(did).join(' | '),fE.map(did).join(' | '),r.estado||'Abierto',fL.map(did).join(' | '),r.medidasAcciones||'',r.reportador||REPORTANTE_DEFAULT,r.jefeInmediato||'',r.persona||'',r.dniObservado||'',fd(r.fechaCierre)]);
  });
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols']=[{wch:10},{wch:11},{wch:7},{wch:16},{wch:18},{wch:10},{wch:24},{wch:30},{wch:40},{wch:40},{wch:10},{wch:40},{wch:40},{wch:12},{wch:22},{wch:22},{wch:12},{wch:11}];
  XLSX.utils.book_append_sheet(wb,ws,EXCEL.sheetName);
  XLSX.writeFile(wb,EXCEL.filePrefix+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('✓ Excel descargado');
}

function imprimirStatsMes(){
  const selMes=document.getElementById('statsMes');
  const selAnio=document.getElementById('statsAnio');
  const anio=selAnio?parseInt(selAnio.value,10):new Date().getFullYear();
  const mes=selMes?parseInt(selMes.value,10):(new Date().getMonth()+1);
  const counts=conteoCambiosPorMes(anio);
  const delMes=counts[mes-1]||0;
  const periodo=statsFiltrando?`${MESES_ES[mes-1]} ${anio}`:`Año ${anio} (todos los meses)`;
  const data=statsFiltrando
    ? getReportes().filter(r=>{const p=parseFechaParts(r.fecha);return p&&p.y===anio&&p.m===mes;})
    : getReportes().filter(r=>{const p=parseFechaParts(r.fecha);return p&&p.y===anio;});
  const abiertos=data.filter(r=>(r.estado||'Abierto')==='Abierto').length;
  const cerrados=data.filter(r=>r.estado==='Cerrado').length;
  const cats={};
  data.forEach(r=>{if(r.categoria) cats[r.categoria]=(cats[r.categoria]||0)+1;});
  const sortedC=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const areasRank=contarPor(data, areaCambioDe);
  const personasRank=rankingPersonas(data);
  const eppsTotal=data.reduce((s,r)=>s+cantidadEppsDe(r),0);
  const mapaDiasPrint=mapaEppsPorDia(anio, statsFiltrando?mes:null);
  const filasDia=Object.keys(mapaDiasPrint).sort().map(k=>{
    const d=mapaDiasPrint[k];
    return `<tr><td>${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}</td><td style="text-align:right;font-family:monospace;">${d.reportes}</td><td style="text-align:right;font-family:monospace;">${d.epps}</td></tr>`;
  }).join('') || '<tr><td colspan="3">Sin cambios en el período</td></tr>';
  const maxMes=Math.max(...counts,1);
  const filasArea=areasRank.length
    ? areasRank.map(([a,n],i)=>`<tr${i===0?' style="background:#e8f1fc;font-weight:700;"':''}><td>${i+1}</td><td>${escapeHtml(a)}</td><td style="text-align:right;font-family:monospace;">${n}</td></tr>`).join('')
    : '<tr><td colspan="3">Sin áreas</td></tr>';
  const filasPers=personasRank.length
    ? personasRank.map((p,i)=>`<tr${i===0?' style="background:#e8f1fc;font-weight:700;"':''}><td>${i+1}</td><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(p.area||'—')}</td><td style="text-align:right;font-family:monospace;">${p.count}</td></tr>`).join('')
    : '<tr><td colspan="4">Sin personas</td></tr>';
  const topArea=areasRank[0];
  const topPersona=personasRank[0];
  const topClasif=sortedC[0];
  const hoy=new Date();
  const fechaTxt=hoy.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const horaTxt=hoy.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const logo=logoPrintSrc();
  const filasMes=counts.map((n,i)=>`<tr${(i+1)===mes&&statsFiltrando?' style="background:#e8f1fc;font-weight:700;"':''}>
    <td>${MESES_ES[i]}</td>
    <td style="text-align:right;font-family:monospace;">${n}</td>
    <td><div style="height:10px;background:#e8edf2;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${Math.round(n/maxMes*100)}%;background:#1a6fd4;"></div></div></td>
  </tr>`).join('');
  const filasCat=sortedC.length
    ? sortedC.map(([c,n])=>`<tr><td>${escapeHtml(c)}</td><td style="text-align:right;font-family:monospace;">${n}</td></tr>`).join('')
    : '<tr><td colspan="2">Sin categorías</td></tr>';
  const h=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>CAMBIO DE EPPS — ${periodo}</title>
<style>
  body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;padding:22px;}
  .hdr{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a2636;padding-bottom:12px;margin-bottom:16px;}
  .hdr img{width:72px;height:72px;object-fit:contain;}
  h1{font-size:16px;margin:0;color:#1a2636;}
  .stamp{display:inline-block;background:#1a2636;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.14em;padding:5px 12px;margin-top:6px;}
  .meta{font-size:11px;color:#555;margin:0 0 14px;}
  .hero{background:#f0f4f8;border:1px solid #d5dde6;border-radius:8px;padding:16px 18px;margin-bottom:16px;}
  .hero b{font-size:42px;font-family:Consolas,monospace;color:#1a6fd4;display:block;line-height:1;}
  .grid{display:flex;gap:10px;margin-bottom:16px;}
  .card{flex:1;border:1px solid #e0e6ec;border-radius:8px;padding:10px 12px;}
  .card span{display:block;font-size:11px;color:#666;text-transform:uppercase;}
  .card strong{font-size:22px;font-family:Consolas,monospace;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#666;border-bottom:1px solid #ddd;padding:6px;}
  td{padding:6px;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#1a2636;margin:18px 0 8px;}
  .footer{margin-top:20px;font-size:10px;color:#888;border-top:2px solid #1a2636;padding-top:8px;text-align:right;}
  @media print{body{padding:10px;}}
</style></head><body>
  <div class="hdr">
    <img src="${logo}" alt="Minera Casma">
    <div>
      <h1>COMPAÑÍA MINERA CASMA SAC</h1>
      <div class="stamp">CAMBIO DE EPPS</div>
      <p class="meta" style="margin-top:6px;">Estadística mensual · ${escapeHtml(periodo)}</p>
    </div>
  </div>
  <div class="hero">
    <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;">Cambios de EPPS · ${escapeHtml(periodo)}</span>
    <b>${statsFiltrando?delMes:data.length}</b>
    <span style="font-size:12px;color:#555;">registros en tiempo real al ${fechaTxt} ${horaTxt}</span>
  </div>
  <div class="grid">
    <div class="card"><span>EPPS cambiados</span><strong>${eppsTotal}</strong></div>
    <div class="card"><span>Registros</span><strong>${statsFiltrando?delMes:data.length}</strong></div>
    <div class="card"><span>Cerrados</span><strong style="color:#1a9e5c;">${cerrados}</strong></div>
    <div class="card"><span>Año ${anio}</span><strong>${counts.reduce((a,b)=>a+b,0)}</strong></div>
  </div>
  <div class="grid">
    <div class="card"><span>Área con más cambios</span><strong style="font-size:14px;">${topArea?escapeHtml(topArea[0]):'—'}</strong><div style="font-size:12px;color:#555;margin-top:4px;">${topArea?topArea[1]+' cambios':''}</div></div>
    <div class="card"><span>Más incidencias</span><strong style="font-size:14px;">${topPersona?escapeHtml(topPersona.nombre):'—'}</strong><div style="font-size:12px;color:#555;margin-top:4px;">${topPersona?topPersona.count+' incidencias':''}</div></div>
    <div class="card"><span>Clasificación más recurrente</span><strong style="font-size:14px;">${topClasif?escapeHtml(topClasif[0]):'—'}</strong><div style="font-size:12px;color:#555;margin-top:4px;">${topClasif?topClasif[1]+' cambios':''}</div></div>
  </div>
  <h2>EPPS cambiados por día · ${escapeHtml(periodo)}</h2>
  <table>
    <thead><tr><th>Fecha</th><th style="text-align:right;">Registros</th><th style="text-align:right;">EPPS</th></tr></thead>
    <tbody>${filasDia}</tbody>
  </table>
  <h2>Cambios de EPPS por mes · ${anio}</h2>
  <table>
    <thead><tr><th>Mes</th><th style="text-align:right;">Cambios</th><th>Distribución</th></tr></thead>
    <tbody>${filasMes}</tbody>
  </table>
  <h2>Área con más cambios de EPPS</h2>
  <table>
    <thead><tr><th>#</th><th>Área / ubicación</th><th style="text-align:right;">Cambios</th></tr></thead>
    <tbody>${filasArea}</tbody>
  </table>
  <h2>Personas con más incidencias</h2>
  <table>
    <thead><tr><th>#</th><th>Persona</th><th>Área laboral</th><th style="text-align:right;">Incidencias</th></tr></thead>
    <tbody>${filasPers}</tbody>
  </table>
  <h2>Clasificación más recurrente · ${escapeHtml(periodo)}</h2>
  <table>
    <thead><tr><th>Clasificación</th><th style="text-align:right;">Cambios</th></tr></thead>
    <tbody>${filasCat}</tbody>
  </table>
  <div class="footer">CAMBIO DE EPPS — Compañía Minera Casma SAC — RUC 20606447192 — ${fechaTxt} ${horaTxt}</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),400);<\/script>
</body></html>`;
  const w=window.open('','_blank');
  if(!w){showToast('Permite ventanas emergentes para imprimir');return;}
  w.document.write(h);w.document.close();
}