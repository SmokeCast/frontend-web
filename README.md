# SmokeCast — Frontend

Aplicación React + Tailwind CSS 4 + Vite. Panel responsive en español con mapa Leaflet, búsqueda, filtros por país e intensidad, lista y detalle de incendios, ciudades, historial meteorológico, riesgo y analítica. Incluye exportación CSV de los incendios filtrados, estados vacíos, errores recuperables y navegación por teclado.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```sh
cd cloud-proyecto-1/frontend
npm ci
npm run dev
```

Abrir la URL que muestre Vite (normalmente http://localhost:5173).

```sh
npm run build
npm run preview
npm test
```

## Datos y conexión a los microservicios

Sin configuración, los cinco servicios usan datos ficticios deterministas de `src/data.js`, correspondientes al 12 de septiembre de 2026. No se necesitan bases de datos para explorar el frontend.

Copiar `.env.example` a `.env.local` y configurar únicamente los servicios disponibles:

```dotenv
VITE_MS1_URL=http://localhost:8081
VITE_MS2_URL=http://localhost:8082
VITE_MS3_URL=http://localhost:8083
VITE_MS4_URL=http://localhost:8084
VITE_MS5_URL=http://localhost:8085
```

Las URLs son bases, sin `/api` final. Reiniciar Vite después de cambiarlas. Cada servicio sin URL sigue en demo. Un servicio configurado se consulta realmente: los errores HTTP, de red o de formato se muestran, sin sustituir silenciosamente datos reales por ficticios. El timeout es de 10 segundos. Las etiquetas API indican origen/configuración, no una comprobación global de disponibilidad.

Las APIs deben permitir CORS desde el origen del frontend. Ms3 ya incluye CORS; Ms2 y Ms4 necesitarán habilitarlo en su backend o exponerse mediante un gateway con CORS. En Amplify, usar endpoints HTTPS accesibles públicamente; localhost apunta al equipo del visitante. Las variables `VITE_*` son públicas: nunca colocar credenciales AWS en ellas.

## Endpoints y estado real del repositorio

| Servicio | Operación principal | Segunda operación | Estado |
| --- | --- | --- | --- |
| Ms1 | `GET /api/fires` | `GET /api/fires/{id}` | Contrato de la guía PDF; backend ausente |
| Ms2 | `GET /api/cities` | `GET /api/cities/{id}` | Implementados; abrir una tarjeta de ciudad |
| Ms3 | `GET /api/weather` | `GET /api/weather/city/{id}` | Implementados; abrir una tarjeta de clima |
| Ms4 | `GET /api/risk/preview` | `GET /api/risk/city/{id}` | Preview implementado; detalle es contrato propuesto |
| Ms5 | `GET /api/analytics/status` | `GET /api/analytics/summary` | Status implementado; summary es contrato propuesto |

Ms4 real devuelve `fire`, `nearby_cities` y `note`; la interfaz muestra sus ciudades cercanas sin inventar predicciones. En demo ofrece tarjetas con llegada simulada y detalle. Para activar ese flujo con datos reales, `/api/risk/preview` debe devolver `{alerts: [{id, city, level, eta_hours, population}], note}` y `/api/risk/city/{id}` el detalle de la evaluación. Ms5 `/api/analytics/summary` debe devolver `[{country: "Perú", detections: 62}]`. Los dos contratos pendientes están centralizados en `src/api.js` para adaptarlos cuando se implementen.

La integración del frontend cubre las dos operaciones de cada servicio con las limitaciones indicadas. Para cumplir la rúbrica con evidencia real, el equipo todavía debe implementar los contratos pendientes, levantar las APIs y desplegar la aplicación; una demo no reemplaza ese requisito.

## Interpretación del mapa

El mapa incluye cartografía local simplificada de Natural Earth (dominio público), descargada de https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson. El mapa funciona sin servicios de teselas, claves API ni conexión externa; la atribución aparece en el mapa. La cartografía tiene resolución regional, apropiada para ubicar los eventos a escala continental. Los puntos son coordenadas del catálogo; filtros y selección funcionan sobre los datos locales o de API.

Los niveles visuales del catálogo se derivan de FRP: crítico >150 MW, alto >90 MW, moderado >30 MW y bajo el resto. Son categorías de interfaz, no umbrales científicos validados ni predicciones de exposición. El área ilustrativa no es una pluma de humo física. Los pronósticos demo no deben usarse para decisiones de emergencia.

## AWS Amplify

Se incluye `amplify.yml` en la raíz de `cloud-proyecto-1` para un repositorio cuyo directorio raíz es esa carpeta. Seleccionar `frontend` como aplicación monorepo y establecer `AMPLIFY_MONOREPO_APP_ROOT=frontend`. Si el repositorio incluye también la carpeta superior y los PDFs, usar `cloud-proyecto-1/frontend` como appRoot y ajustar el archivo de build en Amplify al mismo valor.

El build ejecuta `npm ci` y `npm run build`; el artefacto es `dist`. Definir las URLs HTTPS `VITE_MS*_URL` en las variables de entorno de Amplify antes de compilar. La navegación interna usa estado de React y no requiere reglas adicionales de rutas. Este trabajo no realiza despliegues ni crea recursos AWS.
