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
| MS4 | `/api/risk/preview` |
| MS5 | `/api/analytics/status` |

El catálogo de incendios usa `content`, `totalPages` y `totalElements` de Spring.
Los botones Anterior/Siguiente recorren páginas de 100 registros. Búsqueda, filtros,
métricas y exportación actúan sobre la página cargada. El país de una ciudad se
obtiene de `country` (API) o `country_code` (datos demo).

MS4 muestra ciudades cercanas o explica que no hay incendios/ciudades. No solicita
un detalle de riesgo inexistente ni presenta la vista preliminar como pronóstico.
MS5 muestra que las consultas analíticas están pendientes; no solicita `/summary`.
Los gráficos analíticos y detalles simulados de riesgo solo aparecen en demo.

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
