/**
 * Comercial Onix — Backend de Cotizaciones (prototipo MVP)
 * ------------------------------------------------------------------
 * Da servicio al formulario `cotizador.html`. Una sola hoja de cálculo
 * con varias pestañas hace de base de datos:
 *
 *   • Clientes   → directorio de clientes (razón social, NIT, correo, ...)
 *   • Catalogo   → productos/servicios con su precio de lista e IVA
 *   • Historico  → último precio y fecha que cada cliente pagó por cada ítem
 *
 * Toda la comunicación con el navegador es vía GET + JSONP (parámetro
 * `callback`), para poder LEER la respuesta sin tropezar con CORS. El
 * enrutamiento se hace con el parámetro `action`:
 *
 *   action=ping                              → prueba de vida
 *   action=clientes                          → lista de clientes
 *   action=catalogo                          → lista del catálogo
 *   action=historico&nit=...                 → histórico de ESE cliente
 *   action=bootstrap                         → clientes + catálogo en una sola llamada
 *   action=guardar_cliente&razonSocial=...   → crea/actualiza un cliente
 *   action=consecutivo                       → reserva y devuelve el próximo Nº
 *
 * Despliegue: ver INSTRUCCIONES-COTIZADOR.md
 */

// (Opcional) Pega aquí el ID de tu hoja para usar una específica.
// Si lo dejas vacío, el script crea una hoja propia la primera vez y la
// reutiliza después (su ID queda guardado en las propiedades del script).
const SPREADSHEET_ID = '';

// Nombre del archivo que se crea automáticamente si no fijas SPREADSHEET_ID.
const SS_NAME = 'Cotizaciones Onix (Prototipo)';

// Prefijo del consecutivo de cotizaciones (ej. COT-2026-0001).
const COT_PREFIX = 'COT';

// Encabezados esperados por cada pestaña. Si la pestaña no existe, se crea
// con estos encabezados (y con un par de filas de ejemplo, ver seed_).
const TABS = {
  Clientes:  ['Razon Social', 'NIT', 'Correo', 'Telefono', 'Direccion', 'Ciudad', 'Contacto'],
  Catalogo:  ['Codigo', 'Descripcion', 'Tipo', 'Precio Lista', 'IVA %', 'Unidad'],
  Historico: ['NIT', 'Codigo', 'Descripcion', 'Precio', 'Fecha']
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = (p.action || 'ping').toLowerCase();
  var out;
  try {
    switch (action) {
      case 'ping':            out = { ok: true, msg: 'Endpoint Cotizador Onix activo', ts: new Date() }; break;
      case 'clientes':        out = { ok: true, clientes: readTab_('Clientes') }; break;
      case 'catalogo':        out = { ok: true, catalogo: readTab_('Catalogo') }; break;
      case 'historico':       out = { ok: true, historico: historicoDe_(p.nit) }; break;
      case 'bootstrap':       out = { ok: true, clientes: readTab_('Clientes'), catalogo: readTab_('Catalogo') }; break;
      case 'guardar_cliente': out = guardarCliente_(p); break;
      case 'consecutivo':     out = { ok: true, consecutivo: siguienteConsecutivo_() }; break;
      default:                out = { ok: false, error: 'Acción desconocida: ' + action };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return reply_(out, p.callback);
}

// doPost se mantiene como alias por si en el futuro se prefiere POST.
function doPost(e) { return doGet(e); }

/* ----------------------------- Acciones ----------------------------- */

function guardarCliente_(p) {
  var nit = String(p.nit || '').trim();
  var razon = String(p.razonSocial || '').trim();
  if (!razon) return { ok: false, error: 'Falta la razón social' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getTab_('Clientes');
    var data = readTab_('Clientes');
    // ¿Ya existe (por NIT)? Entonces actualiza esa fila.
    var rowIndex = -1;
    if (nit) {
      for (var i = 0; i < data.length; i++) {
        if (normNit_(data[i]['NIT']) === normNit_(nit)) { rowIndex = i + 2; break; } // +2: encabezado + base 1
      }
    }
    var values = [[ razon, nit, p.correo || '', p.telefono || '',
                    p.direccion || '', p.ciudad || '', p.contacto || '' ]];
    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, values[0].length).setValues(values);
      return { ok: true, actualizado: true, nit: nit };
    }
    sh.appendRow(values[0]);
    return { ok: true, creado: true, nit: nit };
  } finally {
    lock.releaseLock();
  }
}

function siguienteConsecutivo_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var year = new Date().getFullYear();
    var key = 'COT_SEQ_' + year;
    var n = parseInt(props.getProperty(key) || '0', 10) + 1;
    props.setProperty(key, String(n));
    return COT_PREFIX + '-' + year + '-' + ('0000' + n).slice(-4);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Devuelve, para un NIT, un mapa { codigo|descripcion : {precio, fecha} }
 * con el ÚLTIMO precio (fecha más reciente) que ese cliente pagó por cada
 * ítem, y la fecha de su última cotización registrada.
 */
function historicoDe_(nit) {
  var key = normNit_(nit);
  var rows = readTab_('Historico');
  var items = {};       // claveItem -> {precio, fecha}
  var ultimaFecha = null;
  rows.forEach(function (r) {
    if (normNit_(r['NIT']) !== key) return;
    var fecha = r['Fecha'] ? new Date(r['Fecha']) : null;
    if (fecha && (!ultimaFecha || fecha > ultimaFecha)) ultimaFecha = fecha;
    var ck = claveItem_(r['Codigo'], r['Descripcion']);
    var prev = items[ck];
    if (!prev || (fecha && new Date(prev.fecha) < fecha)) {
      items[ck] = { precio: Number(r['Precio']) || 0, fecha: fecha ? fecha.toISOString() : '' };
    }
  });
  return { items: items, ultimaFecha: ultimaFecha ? ultimaFecha.toISOString() : '' };
}

/* ----------------------------- Utilidades --------------------------- */

function claveItem_(codigo, descripcion) {
  var c = String(codigo || '').trim().toUpperCase();
  return c || ('D:' + String(descripcion || '').trim().toUpperCase());
}

function normNit_(v) {
  return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

/** Lee una pestaña y la devuelve como arreglo de objetos {encabezado: valor}. */
function readTab_(name) {
  var sh = getTab_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue; // salta filas vacías
    var obj = {};
    headers.forEach(function (h, i) { if (h) obj[h] = row[i]; });
    out.push(obj);
  }
  return out;
}

/** Devuelve la pestaña; la crea (con encabezados y semilla) si no existe. */
function getTab_(name) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  var headers = TABS[name] || [];
  if (headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    seed_(sh, name);
  }
  return sh;
}

/** Filas de ejemplo SOLO al crear la pestaña por primera vez. Bórralas a gusto. */
function seed_(sh, name) {
  var seeds = {
    Clientes: [
      ['Buencafe Liofilizado SAS', '816000111-1', 'compras@buencafe.com', '6068501234',
       'Cra 4 # 16-50', 'Chinchiná', 'Sebastián Díaz']
    ],
    Catalogo: [
      ['SRV-UPS-PREV', 'Mantenimiento preventivo UPS (visita)', 'Servicio', 350000, 19, 'Visita'],
      ['SRV-UPS-CORR', 'Mantenimiento correctivo UPS (hora)', 'Servicio', 90000, 19, 'Hora'],
      ['BAT-12-7',     'Batería 12V 7Ah',                      'Producto', 65000, 19, 'Unidad']
    ],
    Historico: [
      ['816000111-1', 'SRV-UPS-PREV', 'Mantenimiento preventivo UPS (visita)', 320000, new Date(2025, 10, 12)]
    ]
  };
  (seeds[name] || []).forEach(function (row) { sh.appendRow(row); });
}

function getSS_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create(SS_NAME);
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

/** Responde JSON puro, o JSONP si llega ?callback=... (para lectura sin CORS). */
function reply_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
