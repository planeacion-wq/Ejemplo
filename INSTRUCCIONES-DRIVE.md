# Envío automático a Google Drive (Sheets)

El formulario `orden-servicio-ups.html` puede enviar cada orden diligenciada
directamente a una hoja de Google Sheets, **sin que nadie la transcriba a mano**.

Una página HTML estática no puede escribir en Sheets por sí sola (Google exige
autenticación). La vía más liviana para un MVP —sin servidor y conservando el
modo offline— es un pequeño **Google Apps Script Web App**: un endpoint propio,
en tu cuenta de Google, que recibe los datos y agrega la fila.

> Esto se configura **una sola vez** (~2 minutos). Luego el técnico solo pulsa
> **"Enviar a Drive"**.

---

## Paso a paso (una sola vez)

1. Entra a **https://script.google.com** con la cuenta de Comercial Onix y crea
   un **Nuevo proyecto**.
2. Borra el contenido de `Código.gs` y pega el contenido del archivo
   [`apps-script/Codigo.gs`](apps-script/Codigo.gs) de este repositorio.
   - *(Opcional)* Si quieres que escriba en una hoja que **ya tienes**, copia su
     ID desde la URL de la hoja
     (`.../spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`) y pégalo en la constante
     `SPREADSHEET_ID`. Si lo dejas vacío, el script **crea una hoja nueva** la
     primera vez y la reutiliza siempre.
3. Menú **Implementar → Nueva implementación**.
4. En **Tipo**, elige **Aplicación web** y configura:
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** *Cualquier persona*.
     *(Necesario para que el celular del técnico pueda enviar sin iniciar sesión.
     El endpoint solo recibe datos; no expone la hoja.)*
5. Pulsa **Implementar** y **autoriza** los permisos cuando lo pida.
6. Copia la **URL del Web App** (termina en `/exec`).
7. Abre `orden-servicio-ups.html`, ve a la sección **9 · Envío automático a
   Drive** y pega ahí la URL. Queda guardada en el dispositivo.

¡Listo! Cada **"Enviar a Drive"** agrega una fila con todos los datos.

---

## Cómo funciona

- **Validación primero:** la orden solo se envía si pasa las validaciones
  (no se envían datos con errores). Esto es justamente lo que evita el repaso
  manual del revisor.
- **Una fila por orden:** cada campo del formulario cae bajo una columna con su
  mismo nombre. Si una columna no existe, el script la crea sola. Por eso
  funciona con una hoja nueva o con una existente.
- **Offline con cola:** si el técnico no tiene señal al enviar, la orden queda
  **en cola** en el dispositivo y se sincroniza automáticamente al reconectar
  (o con el botón *"Reintentar pendientes"*).

## Verificar / solucionar

- Para comprobar que el endpoint vive, usa el botón **"Abrir endpoint"**: debe
  mostrar `{"ok":true,"msg":"Endpoint ODS UPS activo"...}`.
- Si cambias el código del script, recuerda **Implementar → Gestionar
  implementaciones → editar → Nueva versión** (o la URL seguirá usando la versión
  anterior).
- ¿Dónde quedó la hoja creada automáticamente? En el **Drive** de la cuenta que
  desplegó el script, con el nombre **"ODS UPS - Campo (Prototipo)"**.

## Nota de seguridad (prototipo)

El endpoint queda abierto a "cualquier persona con el enlace". Para producción
conviene añadir un token compartido (una clave que la app envíe y el script
valide) y restringir orígenes. Puedo agregarlo cuando definamos el alcance.
