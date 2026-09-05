# Informe de cruce: Playlist "AI" ↔ Spreadsheet

_Fecha: 2026-09-05 · Fuente playlist: export de Google Takeout (`IA_videos.csv`)_

## Resumen

| Concepto | Cantidad |
|---|---|
| Entradas en el playlist | 77 |
| **Videos únicos en el playlist** | **75** |
| Filas en el spreadsheet | 68 |
| IDs de video únicos en el spreadsheet | 62 |
| ❌ **En playlist, faltan en el sheet** | **25** |
| ⚠️ En el sheet pero **no** en el playlist | 12 |
| 🔁 Duplicados dentro del sheet | 2 |
| ⚙️ Filas del sheet sin URL válida | 4 |

---

## 1. Duplicados dentro del playlist (YouTube los permite)

- `b1aLqKHFGRw` — *Por qué Claude Mythos es peligroso*
- `QtiTjXuZh30` — *A brief update on the AI apocalypse*

## 2. Duplicados dentro del spreadsheet

| Video ID | Filas | Observación |
|---|---|---|
| `TL8V41Ea6oM` | 60 y 62 | Mismo video con **dos títulos distintos** — hay que quedarse con uno |
| `aq5kZpvqO34` | 64 y 67 | La fila 64 está sin título; la 67 sí lo tiene |

## 3. Filas sin URL válida (el título quedó pegado en la columna URL)

| Fila | Título | Situación |
|---|---|---|
| 55 | You're Not Behind (Yet): How to Build Your First AI Agent (Full Guide) | URL correcta hallada: `Bm84BAtOfQw` |
| 59 | Cómo usar Claude mejor que el 99% de las personas | URL pendiente |
| 65 | How to Build an AI Agent with Claude Code (Claude AI Agent Tutorial) | URL correcta hallada: `bcM9dP_uXJU` |
| 66 | Claude – Full Course 2026 | Es un **playlist**, no un video suelto |

## 4. Videos del playlist que faltan en el sheet (25)

Títulos que sí se pudieron recuperar por búsqueda web:

| Video ID | Título |
|---|---|
| `73eFWU-edO4` | CLAUDE CODE 2026: Curso Completo en Español |
| `ozV6-8Plaiw` | Cómo Invertir En Inteligencia Artificial |
| `Xv5ZrnzA2DA` | Domina NotebookLM en Menos de 7 Minutos (Tutorial Completo) |
| `reqYkjkz840` | Creando un video con Inteligencia Artificial (Platzi) |
| `Bm84BAtOfQw` | You're Not Behind (Yet): How to Build Your First AI Agent — _ya está en fila 55, sólo faltaba la URL_ |
| `bcM9dP_uXJU` | How to Build an AI Agent with Claude Code — _ya está en fila 65, sólo faltaba la URL_ |

Pendientes de título (videos recientes, aún no indexados por buscadores —
el script `sincronizar_playlist.gs` los resuelve automáticamente):

`wtDDjBOfTZo`, `Fys4oHlXQmQ`, `--6Wu5hQ7S0`, `7o-HosLvLr8`, `Xfx0xJBJ6Xs`,
`-gYw7Y8z23c`, `OYvMB3gZOUY`, `DaD3660scLg`, `dxbrDI4-KyQ`, `wgdBZ-UYaE8`,
`tEQeU10TrXc`, `xXxrvra9DQg`, `G769vML0CUM`, `ErFPOYr1w9s`, `vCk89JdMyJ8`,
`E_qVWJaH0W0`, `uEztHu4NHrs`, `WXuK6gekU1Y`, `UwsrzCVZAb8`

## 5. En el sheet pero no en el playlist (12)

No es un error: son videos de la ruta original que nunca se agregaron al
playlist, o que se quitaron de él. Decidir caso por caso si se añaden al
playlist o se dejan sólo en la hoja.

| Fila | Video ID | Título |
|---|---|---|
| 2 | `RhelFr_rMhk` | He probado todas las IAs y esta es la Mejor de 2026 |
| 3 | `82yaSvi1ZDA` | Anthropic Claude vs ChatGPT ¿cuál es mejor para trabajar? |
| 5 | `EQb-M_eWzXU` | ChatGPT vs Claude ¿Cuál es realmente mejor? |
| 10 | `pXk-8G8G5ds` | Qué lenguajes de programación y tecnologías aprender en el 2025 |
| 11 | `R2ZkLdfaGtQ` | Deja de aprender |
| 33 | `OHP_VmAVsS8` | 4 Pasos para Crear tu Segundo Cerebro y Organizar Mejor (con IA) |
| 44 | `JMOvzZOA3zI` | Cómo ChatGPT arruina tu inteligencia |
| 49 | `0rqh5ySV25c` | El imperio de ChatGPT se derrumba: ¿Puede QUEBRAR OpenAI? |
| 54 | `eGZ5-_VzmuM` | Por qué la RAM está tan cara |
| 56 | `0tLHVyd7WtM` | How to Get Ahead of 99% of People (with AI) |
| 57 | `xmlyII9a6mI` | Domina el 80% de Claude en solo 23 minutos |
| 61 | `FANJ1qBb0g0` | Cómo usar Claude desde Cero: ¡Mejor que ChatGPT para organizar tu PC! |

---

## Nota técnica: por qué hace falta el Apps Script

Este entorno **no puede escribir contenido** en una hoja de Google existente
(la herramienta disponible sólo cambia metadatos como el nombre o la carpeta),
ni puede leer YouTube (el proxy de red bloquea `youtube.com`, y el playlist es
privado). El script `sincronizar_playlist.gs` se ejecuta **dentro de la hoja
con la sesión del usuario**, así que resuelve las dos limitaciones a la vez y
además conserva el formato y las columnas Estado/Notas.
