# SmokeCast — Frontend

React, Vite, Tailwind CSS y Leaflet. Panel en español con mapa, catálogo de
incendios, ciudades, clima, vista preliminar de riesgo y estado de analítica.

## Ejecución local

Node.js 22.12 o superior. Desde `frontend-web/`:

```sh
npm ci
# Si todavía no existe .env:
cp env.example .env
npm run dev
```

Abrir la URL indicada por Vite, normalmente http://localhost:5173.
`npm run build` compila, `npm run preview` permite revisar la compilación y
`npm test` verifica los contratos y la validación.

## Variables de entorno

`.env` contiene la configuración local y está excluido de Git. `env.example`
es la plantilla versionable. Reiniciar Vite después de cambiar variables.
Una `.env.local` existente tiene prioridad sobre `.env`; revisarla si los cambios
no se reflejan en la aplicación.

| Variable | Uso | Valor local |
|---|---|---|
| `VITE_DEMO_MODE` | `false` usa APIs; `true` activa datos ficticios explícitamente | `false` |
| `VITE_MS1_URL` | Catálogo de incendios | `http://127.0.0.1:8081` |
| `VITE_MS2_URL` | Ciudades | `http://127.0.0.1:8082` |
| `VITE_MS3_URL` | Meteorología | `http://127.0.0.1:8083` |
| `VITE_MS4_URL` | Vista preliminar de riesgo | `http://127.0.0.1:8084` |
| `VITE_MS5_URL` | Estado de analítica | `http://127.0.0.1:8085` |

En modo real se exigen las cinco URLs. Se validan al iniciar Vite y al compilar:
deben usar HTTP/HTTPS, sin `/api`, rutas, parámetros ni credenciales.
Las variables `VITE_*` son públicas; las contraseñas de las bases solo van en los
`.env` de los microservicios. Para un navegador en otro equipo, usar direcciones
accesibles desde ese equipo y configurar el `HOST` de las APIs.

En demo no se consulta ninguna API. En modo real, un error nunca se reemplaza
por datos ficticios. Se muestran los errores de conexión, HTTP, formato y timeout
(10 segundos), con opción de reintentar.

## Contratos utilizados

| Servicio | Endpoints utilizados |
|---|---|
| MS1 | `/api/v1/fires?page=0&size=100`, `/api/v1/fires/{id}` |
| MS2 | `/api/cities?limit=100`, `/api/cities/{id}` |
| MS3 | `/api/weather`, `/api/weather/city/{id}` |
| MS4 | `/api/risk/preview`, `/api/risk/{city_id}` |
| MS5 | `/api/analytics/status` |

El catálogo de incendios usa `content`, `totalPages` y `totalElements` de Spring.
Los botones Anterior/Siguiente recorren páginas de 100 registros. Búsqueda, filtros,
métricas y exportación actúan sobre la página cargada. El país de una ciudad se
obtiene de `country` (API) o `country_code` (datos demo).

MS4 muestra ciudades cercanas, niveles de riesgo heurísticos y tiempos estimados de
llegada. La interfaz presenta el resultado como evaluación preliminar, no como alerta
oficial ni pronóstico físico de dispersión.
MS5 muestra que las consultas analíticas están pendientes; no solicita `/summary`.
Los gráficos analíticos siguen siendo demostrativos; el detalle de riesgo se consulta
en MS4 cuando se usa el modo real.

## Validaciones de la interfaz

Actualmente no existen formularios de creación o edición. Los únicos campos son
la búsqueda opcional (máximo 100 caracteres) y los selectores de país/intensidad.
No se obliga a rellenar una búsqueda para consultar datos.

Antes de consultar detalles se validan los IDs. Antes de mostrar datos se validan
listas, objetos, coordenadas, cantidades y distancias. Una coordenada inválida no
llega al mapa; las fechas inválidas y valores opcionales ausentes se muestran con
un guion. Los errores tienen mensajes visibles y opción de reintento.
La exportación queda deshabilitada mientras carga, si la consulta falla o no hay
resultados filtrados. Las celdas CSV protegen prefijos interpretables como fórmulas.

## Interpretación del mapa

La cartografía local de Natural Earth permite visualizar el mapa sin claves ni
servicios externos. Las categorías de FRP son indicadores visuales, no niveles de
riesgo sanitario. El área ilustrativa no representa una predicción física del humo.

## Verificación realizada

Compilación de producción y 11 pruebas de contratos/configuración aprobadas.
Se verificaron en navegador de escritorio y móvil la navegación, los detalles,
la paginación, filtros, datos vacíos, errores y reintentos usando respuestas de
API controladas. La configuración incompleta también se probó: el build informa
la variable faltante. Esta prueba de interfaz no reemplaza la ejecución de las
bases reales con tus credenciales.

Los filtros de incendios (país, intensidad y búsqueda por ID/país) consultan MS1
sobre el catálogo completo y reinician la página al cambiar. Requieren la versión
de MS1 que admite `country`, `severity`, `q` y `/api/v1/fires/countries`.
Durante la carga se conservan las filas para evitar el colapso de la tabla;
la barra inferior de paginación permanece visible al recorrerla.

Atmósfera usa `/api/weather/overview` de MS3: una tarjeta por localidad, filtro por
país y páginas de 48 localidades. Riesgo de humo consulta su propio catálogo
paginado de MS1, con país e intensidad independientes de Incendios. Cambiar esos
filtros limpia la selección; cambiar de página conserva el incendio evaluado.
El botón del mapa continúa abriendo la evaluación del incendio seleccionado.
