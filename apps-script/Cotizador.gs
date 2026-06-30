/**
 * Comercial Onix — Backend de Cotizaciones (prototipo MVP)
 * ------------------------------------------------------------------
 * Da servicio al formulario `cotizador.html`. Trabaja con DOS orígenes:
 *
 *   1) HISTÓRICO DE VENTAS (solo lectura) — tu archivo real, ya convertido
 *      a Google Sheets. Columnas: FECHA · FACT · CLIENTE · DETALLE ·
 *      SUBTOTAL · IVA · TOTAL. El cliente se identifica por NOMBRE y el
 *      "qué se vendió" es texto libre. La app lo usa para mostrarle al
 *      comercial las COMPRAS ANTERIORES de ese cliente (fecha, detalle y
 *      valor) y la ÚLTIMA fecha, como referencia para mantener o ajustar
 *      precios.
 *
 *   2) BASE DE LA APP (lectura/escritura) — una hoja propia que el script
 *      crea automáticamente con dos pestañas:
 *        • Clientes  → razón social, NIT, correo, teléfono, dirección, ...
 *        • Catalogo  → ítems frecuentes con precio de lista e IVA (opcional)
 *
 * Comunicación con el navegador: GET + JSONP (parámetro `callback`), para
 * poder LEER la respuesta sin tropezar con CORS. Enrutamiento por `action`:
 *
 *   action=ping
 *   action=bootstrap                          → clientes + catálogo
 *   action=clientes  / action=catalogo
 *   action=historico&cliente=NOMBRE           → compras anteriores del cliente
 *   action=guardar_cliente&razonSocial=...    → crea/actualiza un cliente
 *   action=consecutivo                        → reserva y devuelve PP-MMAAAA-NNN
 *
 * Despliegue y conversión del histórico: ver INSTRUCCIONES-COTIZADOR.md
 */

/* ===================== CONFIGURACIÓN (edítame) ===================== */

// 1) Pega el ID de tu HISTÓRICO DE VENTAS ya convertido a Google Sheets.
//    El ID es lo que va entre /d/ y /edit en la URL:
//    https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
//    Si lo dejas vacío, la app funciona igual pero sin "compras anteriores".
const HISTORICO_SS_ID = '';
const HISTORICO_TAB    = '';   // vacío = primera pestaña del archivo.

// 2) Base de la app (Clientes/Catalogo). Déjalo vacío para que el script
//    cree y reutilice su propia hoja automáticamente.
const DB_SS_ID = '';
const DB_NAME  = 'Cotizaciones Onix (Prototipo)';

// 3) Consecutivo. Tu formato es PP-MMAAAA-NNN (ej. PP-062021-304).
//    Pon en NUMERO_INICIAL el ÚLTIMO número que ya usaste (mira tu archivo
//    de trazabilidad). El próximo será NUMERO_INICIAL + 1.
const COT_PREFIX    = 'PP';
const NUMERO_INICIAL = 0;

/* ===================== Encabezados de la base ===================== */
const TABS = {
  Clientes:  ['Razon Social', 'NIT', 'Correo', 'Telefono', 'Direccion', 'Ciudad', 'Contacto'],
  Catalogo:  ['Codigo', 'Descripcion', 'Tipo', 'Precio Lista', 'IVA %', 'Unidad']
};

/* ===================== Enrutador ===================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = (p.action || 'ping').toLowerCase();
  var out;
  try {
    switch (action) {
      case 'ping':            out = { ok: true, msg: 'Endpoint Cotizador Onix activo', ts: new Date(), historico: !!HISTORICO_SS_ID }; break;
      case 'clientes':        out = { ok: true, clientes: readTab_('Clientes') }; break;
      case 'catalogo':        out = { ok: true, catalogo: readTab_('Catalogo') }; break;
      case 'bootstrap':       out = { ok: true, clientes: readTab_('Clientes'), catalogo: readTab_('Catalogo'), historico: !!HISTORICO_SS_ID }; break;
      case 'historico':       out = { ok: true, historico: comprasDe_(p.cliente) }; break;
      case 'guardar_cliente': out = guardarCliente_(p); break;
      case 'consecutivo':     out = { ok: true, consecutivo: siguienteConsecutivo_() }; break;
      default:                out = { ok: false, error: 'Acción desconocida: ' + action };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return reply_(out, p.callback);
}

function doPost(e) { return doGet(e); }

/* ===================== HISTÓRICO (solo lectura) ===================== */

/**
 * Devuelve, para un nombre de cliente, sus compras anteriores tomadas del
 * HISTÓRICO DE VENTAS: { ultimaFecha, compras:[{fecha,detalle,subtotal,iva,total}] }.
 * El match es por nombre normalizado (ignora mayúsculas, tildes y signos),
 * aceptando coincidencia parcial en cualquiera de los dos sentidos.
 */
function comprasDe_(nombre) {
  var q = normName_(nombre);
  var empty = { ultimaFecha: '', compras: [] };
  if (!HISTORICO_SS_ID || !q || q.length < 3) return empty;

  var sh = histSheet_();
  if (!sh) return empty;
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return empty;
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();

  var idx = histHeaderIndex_(values);
  if (idx.cliente == null) return empty;

  var compras = [], ultima = null;
  for (var r = idx.headerRow + 1; r < values.length; r++) {
    var row = values[r];
    var cli = normName_(row[idx.cliente]);
    if (!cli) continue;
    if (!(cli === q || cli.indexOf(q) !== -1 || q.indexOf(cli) !== -1)) continue;

    var fecha = toDate_(idx.fecha != null ? row[idx.fecha] : null);
    if (fecha && (!ultima || fecha > ultima)) ultima = fecha;
    compras.push({
      fecha:    fecha ? fecha.toISOString() : '',
      detalle:  idx.detalle  != null ? String(row[idx.detalle] || '') : '',
      subtotal: idx.subtotal != null ? toNum_(row[idx.subtotal]) : 0,
      iva:      idx.iva      != null ? toNum_(row[idx.iva]) : 0,
      total:    idx.total    != null ? toNum_(row[idx.total]) : 0
    });
  }
  compras.sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
  return { ultimaFecha: ultima ? ultima.toISOString() : '', compras: compras.slice(0, 20) };
}

function histSheet_() {
  var ss = SpreadsheetApp.openById(HISTORICO_SS_ID);
  if (HISTORICO_TAB) return ss.getSheetByName(HISTORICO_TAB);
  return ss.getSheets()[0];
}

/** Localiza la fila de encabezados (busca CLIENTE y DETALLE) y mapea columnas. */
function histHeaderIndex_(values) {
  var alias = {
    fecha:    ['FECHA'],
    fact:     ['FACT', 'FACTURA', 'DOCUMENTO', 'No'],
    cliente:  ['CLIENTE', 'NOMBRE', 'RAZON SOCIAL'],
    detalle:  ['DETALLE', 'DESCRIPCION', 'CONCEPTO'],
    subtotal: ['SUBTOTAL', 'VALOR', 'BASE'],
    iva:      ['IVA'],
    total:    ['TOTAL']
  };
  for (var r = 0; r < Math.min(values.length, 15); r++) {
    var norm = values[r].map(function (c) { return String(c || '').trim().toUpperCase(); });
    var idx = { headerRow: r };
    Object.keys(alias).forEach(function (key) {
      idx[key] = null;
      for (var c = 0; c < norm.length; c++) {
        if (alias[key].indexOf(norm[c]) !== -1) { idx[key] = c; break; }
      }
    });
    if (idx.cliente != null && idx.detalle != null) return idx;
  }
  return { headerRow: 0, cliente: null };
}

/* ===================== CLIENTES / CATÁLOGO ===================== */

function guardarCliente_(p) {
  var nit = String(p.nit || '').trim();
  var razon = String(p.razonSocial || '').trim();
  if (!razon) return { ok: false, error: 'Falta la razón social' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getTab_('Clientes');
    var data = readTab_('Clientes');
    var rowIndex = -1;
    if (nit) {
      for (var i = 0; i < data.length; i++) {
        if (normNit_(data[i]['NIT']) === normNit_(nit)) { rowIndex = i + 2; break; }
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

/* ===================== CONSECUTIVO ===================== */

function siguienteConsecutivo_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var n = parseInt(props.getProperty('COT_SEQ') || '0', 10);
    if (n < NUMERO_INICIAL) n = NUMERO_INICIAL;
    n += 1;
    props.setProperty('COT_SEQ', String(n));
    var d = new Date();
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var yyyy = d.getFullYear();
    return COT_PREFIX + '-' + mm + yyyy + '-' + ('00' + n).slice(-3);
  } finally {
    lock.releaseLock();
  }
}

/* ===================== Base de la app (Sheets) ===================== */

function readTab_(name) {
  var sh = getTab_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    headers.forEach(function (h, i) { if (h) obj[h] = row[i]; });
    out.push(obj);
  }
  return out;
}

function getTab_(name) {
  var ss = getDB_();
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
  if (name === 'Catalogo') {
    [['SRV-UPS-PREV', 'Mantenimiento preventivo UPS (visita)', 'Servicio', 350000, 19, 'Visita'],
     ['SRV-UPS-CORR', 'Mantenimiento correctivo UPS (hora)',   'Servicio',  90000, 19, 'Hora'],
     ['BAT-12-7',     'Batería 12V 7Ah',                       'Producto',  65000, 19, 'Unidad']
    ].forEach(function (row) { sh.appendRow(row); });
  }
}

function getDB_() {
  if (DB_SS_ID) return SpreadsheetApp.openById(DB_SS_ID);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create(DB_NAME);
  props.setProperty('DB_SS_ID', ss.getId());
  return ss;
}

/* ===================== Utilidades ===================== */

function normName_(v) {
  return String(v == null ? '' : v)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function normNit_(v) { return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase(); }

function toNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d) ? null : d;
}

function reply_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
