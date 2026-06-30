# Cotizador de Servicios y Productos — Comercial Onix

`cotizador.html` es una app de una sola página para que el equipo comercial
arme cotizaciones: **selecciona el cliente** (o lo crea), agrega ítems del
catálogo o líneas libres, y la app le muestra las **compras anteriores** de ese
cliente (fecha, detalle y valor) tomadas del histórico real, para decidir si
**mantiene o ajusta** los precios. Al final genera un **PDF** con membrete, IVA
y vigencia, y un consecutivo con tu formato `PP-MMAAAA-NNN`.

Funciona con un pequeño **Google Apps Script Web App** (sin servidor propio,
datos en tu cuenta de Google), igual filosofía que la Orden de Servicio.

---

## Orígenes de datos

| Origen | Uso | Quién escribe |
|---|---|---|
| **HISTORICO DE VENTAS** (tu archivo real) | Mostrar compras anteriores y última fecha por cliente | Solo lectura |
| **Base de la app** (la crea el script) | Pestañas `Clientes` y `Catalogo` | La app |

> **Importante (paso obligatorio):** tu `HISTORICO DE VENTAS` está en **Excel
> (.xlsx)**. Apps Script solo lee/escribe **Google Sheets**, así que primero hay
> que convertirlo (ver más abajo). Sus columnas reales son:
> `FECHA · FACT · CLIENTE · DETALLE · SUBTOTAL · IVA · TOTAL`. El cliente se
> identifica **por nombre** y el detalle es texto libre; por eso la app cruza
> por **nombre de cliente** y muestra el historial como referencia (no por
> código de producto).

---

## Paso 0 · Convertir el histórico a Google Sheets (una vez)

1. En Drive, abre **`HISTORICO DE VENTAS.xlsx`**.
2. Menú **Archivo → Guardar como Hojas de cálculo de Google**. Se crea un
   archivo nuevo en formato Sheets (el `.xlsx` queda intacto).
3. Si vas a seguir registrando ventas nuevas, hazlo **en esa versión Google
   Sheets** de ahora en adelante (es la que la app consulta).
4. Copia su **ID** desde la URL: `.../spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`.

## Paso 1 · Publicar el Apps Script

1. Entra a **https://script.google.com** con la cuenta de Comercial Onix → **Nuevo proyecto**.
2. Borra `Código.gs` y pega el contenido de
   [`apps-script/Cotizador.gs`](apps-script/Cotizador.gs).
3. Arriba del archivo, en **CONFIGURACIÓN**, edita:
   - `HISTORICO_SS_ID` → pega el **ID** del Paso 0.
   - `NUMERO_INICIAL` → el **último consecutivo** que ya usaste (solo el número;
     ej. si tu última fue `PP-102022-740`, pon `740`). El próximo será 741.
   - `DB_SS_ID` → déjalo vacío (el script crea la base `Clientes/Catalogo` sola).
4. Menú **Implementar → Nueva implementación → Tipo: Aplicación web**:
   - **Ejecutar como:** *Yo*. · **Quién tiene acceso:** *Cualquier persona*.
5. **Implementar**, **autoriza** los permisos, y copia la **URL del Web App**
   (termina en `/exec`).
6. Abre `cotizador.html` → sección **⚙ Conexión a la base de datos** → pega la
   URL → **“Cargar / actualizar datos”**. Queda guardada en el dispositivo.

¡Listo! Selecciona un cliente y verás sus compras anteriores.

---

## Las pestañas que crea la app

### `Clientes`
| Razon Social | NIT | Correo | Telefono | Direccion | Ciudad | Contacto |
|---|---|---|---|---|---|---|

Los clientes nuevos creados desde la app se agregan aquí (si el NIT ya existe,
**actualiza** esa fila en vez de duplicar). La **Razón social** es la que se
cruza contra el `CLIENTE` del histórico, así que conviene escribirla parecida.

### `Catalogo` (opcional)
| Codigo | Descripcion | Tipo | Precio Lista | IVA % | Unidad |
|---|---|---|---|---|---|

Ítems frecuentes con precio sugerido. Si prefieres, cotiza todo como **ítem
libre** y deja el catálogo vacío.

---

## Cómo funciona

- **Cliente:** selecciónalo de la base (filtra por razón social o NIT) o usa
  *“Crear cliente nuevo”*. Al elegirlo —o al escribir la razón social de uno no
  listado— la app consulta el histórico y muestra **última fecha** + lista de
  **compras anteriores** (fecha · detalle · valor).
- **Ítems:** del catálogo (con precio de lista sugerido) o líneas libres con
  precio manual. Cantidad, **IVA % por línea** (19 % por defecto) y unidad.
- **Condiciones:** validez (por defecto +15 días), forma de pago, tiempo de
  entrega y observaciones; salen impresas en el PDF.
- **PDF:** botón *“Generar PDF”* → en el diálogo elige **“Guardar como PDF”**.
  Lleva el consecutivo `PP-MMAAAA-NNN` (mes y año actuales + número correlativo).
- **Offline:** clientes y catálogo quedan en caché; puedes cotizar sin señal.
  Los clientes creados sin conexión se **encolan** y se sincronizan al reconectar.
  Sin conexión el consecutivo es provisional (`PP-MMAAAA-Lnnn`) hasta reconectar.

> **Registro en TRAZABILIDAD COTIZACIONES:** por ahora la app **solo numera**
> (no escribe en ese archivo). Cuando quieras activar el registro automático,
> conviértelo también a Google Sheets y lo conectamos (columnas
> `Cliente · Detalle · Documento · Fecha · Observaciones`).

---

## Verificar / solucionar

- Botón **“Probar conexión”** → debe decir *Conexión OK ✓*. Si no, revisa que
  la URL termine en `/exec` y el acceso sea *Cualquier persona*.
- ¿No aparecen compras anteriores? Verifica que `HISTORICO_SS_ID` apunte a la
  versión **Google Sheets** (no al `.xlsx`) y que el nombre del cliente se
  parezca al que figura en el histórico.
- Si **cambias el código** del script: **Implementar → Gestionar implementaciones
  → editar → Nueva versión** (si no, la URL sigue en la versión anterior).
- La base `Clientes/Catalogo` creada automáticamente queda en el **Drive** de la
  cuenta que desplegó el script, como **“Cotizaciones Onix (Prototipo)”**.

## Nota de seguridad (prototipo)

El endpoint queda abierto a “cualquier persona con el enlace” y, por usar JSONP,
las lecturas viajan por la URL. Para producción conviene un **token compartido**
y restringir orígenes. Se agrega cuando definamos el alcance.
