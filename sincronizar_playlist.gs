/**
 * SINCRONIZAR PLAYLIST DE YOUTUBE → HOJA "Ruta de Aprendizaje de IA"
 * ------------------------------------------------------------------
 * Qué hace:
 *   1. Busca tu playlist de YouTube por nombre (por defecto "AI").
 *   2. Añade a la hoja los videos del playlist que aún no estén.
 *   3. Rellena Título y Canal donde estén vacíos (o mal puestos).
 *   4. Marca duplicados y videos que están en la hoja pero ya no en el playlist.
 *   5. NUNCA toca tus columnas Estado ni Notas de filas existentes.
 *
 * INSTALACIÓN (una sola vez):
 *   a) Abre la hoja → menú Extensiones → Apps Script.
 *   b) Borra lo que haya y pega este archivo completo.
 *   c) Panel izquierdo: Servicios (+) → "YouTube Data API v3" → Añadir.
 *   d) Guarda (icono del disquete).
 *
 * USO: vuelve a la hoja y recárgala (F5). Aparecerá un menú nuevo arriba
 * llamado "▶ Playlist IA". Haz clic en él → "Sincronizar ahora".
 * La primera vez Google pedirá autorización (ver guía paso a paso).
 *
 * Cada vez que agregues videos al playlist, repite solo ese clic del menú.
 */

// ---------- CONFIGURACIÓN ----------
var NOMBRE_PLAYLIST = 'AI';   // nombre exacto de tu playlist en YouTube
var FILA_ENCABEZADO = 1;      // fila donde están los títulos de columna

// Columnas (1 = A). Ajusta sólo si cambias el orden de la hoja.
var COL = {
  orden:  1,  // A
  track:  2,  // B
  nivel:  3,  // C
  tema:   4,  // D
  titulo: 5,  // E
  canal:  6,  // F
  url:    7,  // G
  estado: 8,  // H
  notas:  9   // I
};

/**
 * Crea el menú "▶ Playlist IA" dentro de la hoja.
 * Se ejecuta solo cada vez que abres el archivo.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('▶ Playlist IA')
    .addItem('Sincronizar ahora', 'sincronizarPlaylist')
    .addToUi();
}

// ---------- FUNCIÓN PRINCIPAL ----------
function sincronizarPlaylist() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var idsPlaylist = obtenerVideosDePlaylist_(NOMBRE_PLAYLIST);
  if (!idsPlaylist.length) {
    mostrarResumen_('No se encontró ningún playlist tuyo llamado "' + NOMBRE_PLAYLIST +
                    '", o está vacío.\n\nRevisa que el nombre esté escrito igual ' +
                    '(mayúsculas incluidas) en la línea NOMBRE_PLAYLIST del script.');
    return;
  }

  // --- Leer estado actual de la hoja ---
  var ultimaFila = hoja.getLastRow();
  var nFilas = ultimaFila - FILA_ENCABEZADO;
  var datos = nFilas > 0
    ? hoja.getRange(FILA_ENCABEZADO + 1, 1, nFilas, COL.notas).getValues()
    : [];

  var idsEnHoja = {};        // videoId -> [números de fila]
  var filasSinId = [];
  datos.forEach(function (fila, i) {
    var nFila = FILA_ENCABEZADO + 1 + i;
    var vid = extraerId_(fila[COL.url - 1]);
    if (vid) {
      if (!idsEnHoja[vid]) idsEnHoja[vid] = [];
      idsEnHoja[vid].push(nFila);
    } else if (String(fila[COL.titulo - 1]).trim() || String(fila[COL.url - 1]).trim()) {
      filasSinId.push(nFila);
    }
  });

  // --- Qué falta añadir ---
  var faltantes = idsPlaylist.filter(function (id) { return !idsEnHoja[id]; });

  // --- Metadatos de: los faltantes + los que están sin título en la hoja ---
  var necesitanMeta = faltantes.slice();
  Object.keys(idsEnHoja).forEach(function (id) {
    var f = idsEnHoja[id][0];
    var titulo = String(datos[f - FILA_ENCABEZADO - 1][COL.titulo - 1]).trim();
    var url = String(datos[f - FILA_ENCABEZADO - 1][COL.url - 1]).trim();
    // título vacío, o la celda URL no parece una URL (título mal pegado)
    if (!titulo || url.indexOf('http') !== 0) necesitanMeta.push(id);
  });
  var meta = obtenerMetadatos_(dedup_(necesitanMeta));

  // --- 1) Completar títulos/canales/URLs de filas existentes ---
  var completados = 0;
  Object.keys(idsEnHoja).forEach(function (id) {
    if (!meta[id]) return;
    idsEnHoja[id].forEach(function (f) {
      var idx = f - FILA_ENCABEZADO - 1;
      var titulo = String(datos[idx][COL.titulo - 1]).trim();
      var canal  = String(datos[idx][COL.canal - 1]).trim();
      var url    = String(datos[idx][COL.url - 1]).trim();
      if (!titulo) { hoja.getRange(f, COL.titulo).setValue(meta[id].titulo); completados++; }
      if (!canal)  { hoja.getRange(f, COL.canal).setValue(meta[id].canal); }
      if (url.indexOf('http') !== 0) {
        hoja.getRange(f, COL.url).setValue('https://youtu.be/' + id);
      }
    });
  });

  // --- 2) Marcar duplicados dentro de la hoja ---
  var duplicados = [];
  Object.keys(idsEnHoja).forEach(function (id) {
    if (idsEnHoja[id].length > 1) {
      duplicados.push(id + ' (filas ' + idsEnHoja[id].join(', ') + ')');
      idsEnHoja[id].slice(1).forEach(function (f) {
        marcarNota_(hoja, f, 'DUPLICADO de fila ' + idsEnHoja[id][0]);
      });
    }
  });

  // --- 3) Marcar los que están en la hoja pero ya no en el playlist ---
  var setPlaylist = {};
  idsPlaylist.forEach(function (id) { setPlaylist[id] = true; });
  var soloHoja = [];
  Object.keys(idsEnHoja).forEach(function (id) {
    if (!setPlaylist[id]) {
      soloHoja.push(id);
      marcarNota_(hoja, idsEnHoja[id][0], 'No está en el playlist ' + NOMBRE_PLAYLIST);
    }
  });

  // --- 4) Añadir los faltantes al final ---
  var nuevas = [];
  faltantes.forEach(function (id) {
    var m = meta[id] || { titulo: '(título no disponible)', canal: '' };
    var fila = new Array(COL.notas).fill('');
    fila[COL.titulo - 1] = m.titulo;
    fila[COL.canal - 1]  = m.canal;
    fila[COL.url - 1]    = 'https://youtu.be/' + id;
    fila[COL.notas - 1]  = 'Añadido desde playlist ' + NOMBRE_PLAYLIST;
    nuevas.push(fila);
  });
  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, COL.notas).setValues(nuevas);
  }

  // --- Resumen ---
  var msg =
    'LISTO. Playlist "' + NOMBRE_PLAYLIST + '": ' + idsPlaylist.length + ' videos únicos.\n\n' +
    '• Videos añadidos a la hoja: ' + nuevas.length + '\n' +
    '• Títulos completados: ' + completados + '\n' +
    '• Duplicados marcados: ' + duplicados.length +
      (duplicados.length ? '\n    ' + duplicados.join('\n    ') : '') + '\n' +
    '• En la hoja pero NO en el playlist: ' + soloHoja.length + '\n' +
    '• Filas sin URL válida (revisar a mano): ' +
      (filasSinId.length ? filasSinId.join(', ') : 'ninguna');
  mostrarResumen_(msg);
}

// ---------- AUXILIARES ----------

/**
 * Muestra el resultado. Intenta una ventana emergente; si no se puede
 * (por ejemplo al ejecutar desde el editor de código), lo deja en el
 * registro de ejecución para que igual se pueda leer.
 */
function mostrarResumen_(texto) {
  try {
    SpreadsheetApp.getUi().alert(texto);
  } catch (e) {
    Logger.log(texto);
  }
  Logger.log(texto);
}

/** Devuelve los IDs de video (sin duplicados) del playlist con ese nombre. */
function obtenerVideosDePlaylist_(nombre) {
  var playlistId = null, pageToken = null;
  do {
    var res = YouTube.Playlists.list('snippet', { mine: true, maxResults: 50, pageToken: pageToken });
    (res.items || []).forEach(function (p) {
      if (p.snippet.title === nombre) playlistId = p.id;
    });
    pageToken = res.nextPageToken;
  } while (pageToken && !playlistId);

  if (!playlistId) return [];

  var ids = [];
  pageToken = null;
  do {
    var r = YouTube.PlaylistItems.list('contentDetails', {
      playlistId: playlistId, maxResults: 50, pageToken: pageToken
    });
    (r.items || []).forEach(function (it) { ids.push(it.contentDetails.videoId); });
    pageToken = r.nextPageToken;
  } while (pageToken);

  return dedup_(ids);
}

/** { videoId: {titulo, canal} } para una lista de IDs (en lotes de 50). */
function obtenerMetadatos_(ids) {
  var out = {};
  for (var i = 0; i < ids.length; i += 50) {
    var lote = ids.slice(i, i + 50);
    var res = YouTube.Videos.list('snippet', { id: lote.join(','), maxResults: 50 });
    (res.items || []).forEach(function (v) {
      out[v.id] = { titulo: v.snippet.title, canal: v.snippet.channelTitle };
    });
  }
  return out;
}

/** Extrae el ID de video de cualquier formato de URL de YouTube. */
function extraerId_(valor) {
  var s = String(valor || '').trim();
  if (s.indexOf('http') !== 0) return null;          // no es URL
  if (s.indexOf('/playlist?') !== -1) return null;   // es un playlist, no un video
  var m = s.match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Añade texto a la columna Notas sin borrar lo que ya haya. */
function marcarNota_(hoja, fila, texto) {
  var celda = hoja.getRange(fila, COL.notas);
  var actual = String(celda.getValue()).trim();
  if (actual.indexOf(texto) !== -1) return;          // ya está marcado
  celda.setValue(actual ? actual + ' | ' + texto : texto);
}

function dedup_(arr) {
  var visto = {}, out = [];
  arr.forEach(function (x) { if (!visto[x]) { visto[x] = true; out.push(x); } });
  return out;
}
