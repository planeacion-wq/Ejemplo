/**
 * Comercial Onix — Endpoint para Orden de Servicio UPS (prototipo MVP)
 * ------------------------------------------------------------------
 * Recibe los datos del formulario (orden-servicio-ups.html) y los
 * agrega como una fila en una hoja de Google Sheets, sin digitación
 * manual. La escritura es "dirigida por encabezados": cada clave del
 * payload se coloca bajo la columna con ese mismo nombre; si la columna
 * no existe, se crea automáticamente. Así funciona tanto con una hoja
 * nueva como apuntando a una hoja existente.
 *
 * Despliegue: ver INSTRUCCIONES-DRIVE.md
 */

// (Opcional) Pega aquí el ID de tu hoja para escribir en una específica.
// Si lo dejas vacío, el script crea una hoja propia la primera vez y la
// reutiliza después (su ID queda guardado en las propiedades del script).
const SPREADSHEET_ID = '';

// Nombre de la pestaña donde se agregan las órdenes.
const SHEET_NAME = 'ODS Campo';

function doGet() {
  return json_({ ok: true, msg: 'Endpoint ODS UPS activo', ts: new Date() });
}

function doPost(e) {
  try {
    var raw = (e && e.parameter && e.parameter.payload) ||
              (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);
    if (data.ping) return json_({ ok: true, pong: true });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000); // evita filas pisadas si llegan envíos simultáneos
    try {
      var sh = getSheet_();

      // Encabezados actuales
      var lastCol = sh.getLastColumn();
      var headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      if (headers.length === 0) {
        headers = ['MARCA DE TIEMPO'];
        sh.getRange(1, 1, 1, 1).setValues([headers]);
      }
      var hmap = {};
      headers.forEach(function (h, i) { hmap[h] = i; });

      function ensure(name) {
        if (!(name in hmap)) {
          headers.push(name);
          hmap[name] = headers.length - 1;
          sh.getRange(1, headers.length, 1, 1).setValue(name);
        }
        return hmap[name];
      }

      var row = [];
      function put(name, value) {
        var idx = ensure(name);
        while (row.length <= idx) row.push('');
        row[idx] = value;
      }

      put('MARCA DE TIEMPO', new Date());
      Object.keys(data).forEach(function (k) { put(k, data[k]); });

      while (row.length < headers.length) row.push('');
      sh.appendRow(row);

      return json_({ ok: true, row: sh.getLastRow(), sheetUrl: sh.getParent().getUrl() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getSheet_() {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SS_ID');
    if (id) {
      try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
    }
    if (!ss) {
      ss = SpreadsheetApp.create('ODS UPS - Campo (Prototipo)');
      props.setProperty('SS_ID', ss.getId());
    }
  }
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
