# Cotizador de Servicios y Productos — Comercial Onix

`cotizador.html` es una app de una sola página para que el equipo comercial
arme cotizaciones: **selecciona el cliente de una base de datos** (o crea uno
nuevo), agrega ítems del **catálogo** o líneas libres, y la app **sugiere
precios** según el historial de ese cliente (último precio + fecha) y el precio
de lista. Al final genera un **PDF** con membrete, IVA y vigencia de la oferta.

La base de datos es **una hoja de Google Sheets** con tres pestañas
(`Clientes`, `Catalogo`, `Historico`), atendida por un pequeño **Google Apps
Script Web App** (igual filosofía que la Orden de Servicio: sin servidor
propio, datos en tu cuenta de Google).

> Configuración **una sola vez** (~3 minutos). Luego el comercial solo abre la
> página y cotiza.

---

## Paso a paso (una sola vez)

1. Entra a **https://script.google.com** con la cuenta de Comercial Onix y crea
   un **Nuevo proyecto**.
2. Borra el contenido de `Código.gs` y pega el contenido de
   [`apps-script/Cotizador.gs`](apps-script/Cotizador.gs).
   - *(Opcional)* Si quieres usar una hoja que **ya tienes**, copia su ID desde
     la URL (`.../spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`) y pégalo en la
     constante `SPREADSHEET_ID`. Si lo dejas vacío, el script **crea una hoja
     nueva** la primera vez (con pestañas y filas de ejemplo) y la reutiliza.
3. Menú **Implementar → Nueva implementación**.
4. En **Tipo**, elige **Aplicación web**:
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** *Cualquier persona*.
5. **Implementar** y **autoriza** los permisos cuando lo pida.
6. Copia la **URL del Web App** (termina en `/exec`).
7. Abre `cotizador.html`, despliega **⚙ Conexión a la base de datos**, pega ahí
   la URL y pulsa **“Cargar / actualizar datos”**. La URL queda guardada en el
   dispositivo.

¡Listo! La app ya lee clientes y catálogo, y sugiere precios por cliente.

---

## La base de datos (las 3 pestañas)

El script crea las pestañas con estos encabezados (puedes agregar/editar filas a
mano en Sheets cuando quieras; respeta los nombres de los encabezados):

### `Clientes`
| Razon Social | NIT | Correo | Telefono | Direccion | Ciudad | Contacto |
|---|---|---|---|---|---|---|

Los clientes nuevos creados desde la app se agregan aquí automáticamente
(si el NIT ya existe, se **actualiza** esa fila en vez de duplicar).

### `Catalogo`
| Codigo | Descripcion | Tipo | Precio Lista | IVA % | Unidad |
|---|---|---|---|---|---|

`Tipo` = Producto o Servicio. `Precio Lista` e `IVA %` (ej. 19) se autocompletan
al elegir el ítem en la cotización.

### `Historico`
| NIT | Codigo | Descripcion | Precio | Fecha |
|---|---|---|---|---|

Una fila por venta/cotización pasada. La app toma, para cada ítem, la fila con
la **fecha más reciente** de ese cliente y la ofrece como “último precio”.
La **fecha más reciente** de todo el cliente es la que aparece como
*“Última cotización…”* al seleccionarlo.

> Puedes cargar el histórico real exportándolo de tu sistema actual a esta
> pestaña (basta con respetar las 5 columnas).

---

## Cómo funciona

- **Selección de cliente:** filtra por razón social o NIT y selecciona. Sus
  datos se autocompletan; si cambió algo, edítalo y pulsa *“Guardar cliente”*.
- **Cliente nuevo:** enlace *“Crear cliente nuevo”* → diligencia los datos →
  *“Guardar cliente en la base”*. Queda disponible para todo el equipo.
- **Sugerencia de precios (mixta):** al agregar un ítem del catálogo, si ese
  cliente ya lo compró, ves dos botones rápidos — *Mantener* (su último precio)
  y *Usar lista* — además del precio editable. Así decides mantener o modificar.
- **IVA configurable:** 19 % por defecto por línea, editable por ítem.
- **Vigencia y condiciones:** validez (por defecto +15 días), forma de pago,
  tiempo de entrega y observaciones salen impresos en el PDF.
- **PDF:** botón *“Generar PDF”* abre el diálogo de impresión del navegador
  → elige **“Guardar como PDF”**. Lleva consecutivo (ej. `COT-2026-0001`).
- **Funciona offline:** clientes y catálogo quedan en caché en el dispositivo;
  puedes cotizar y generar PDF sin señal. Los clientes nuevos creados sin
  conexión se **encolan** y se sincronizan al reconectar (al pulsar *“Cargar /
  actualizar datos”*). Sin conexión, el consecutivo es provisional
  (`COT-AÑO-Lnnn`) hasta que el servidor asigne el definitivo.

---

## Verificar / solucionar

- Botón **“Probar conexión”**: debe mostrar *Conexión OK ✓*. Si no, revisa que
  la URL termine en `/exec` y que el acceso sea *Cualquier persona*.
- Si **cambias el código** del script, recuerda **Implementar → Gestionar
  implementaciones → editar → Nueva versión** (si no, la URL sigue usando la
  versión anterior).
- ¿Dónde quedó la hoja creada automáticamente? En el **Drive** de la cuenta que
  desplegó el script, con el nombre **“Cotizaciones Onix (Prototipo)”**.

## Nota de seguridad (prototipo)

El endpoint queda abierto a “cualquier persona con el enlace” y, por usar JSONP,
las lecturas viajan por la URL. Para producción conviene añadir un **token
compartido** (clave que la app envíe y el script valide), restringir lecturas y
considerar mover la app a HtmlService (mismo origen, sin JSONP). Se puede
agregar cuando definamos el alcance.
