import { fires, cities, weather, risks, analytics } from './data.js';
import { readConfig } from './config.js';

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El servicio devolvió un registro inválido.');
  }
  return value;
}
function number(value, field, min = -Infinity, max = Infinity, integer = false) {
  const parsed = Number(value);
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' ||
      !Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isSafeInteger(parsed))) {
    throw new Error(`Valor inválido para ${field}.`);
  }
  return parsed;
}
const id = value => number(value, 'ID', 1, Number.MAX_SAFE_INTEGER, true);
function text(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') throw new Error('El servicio devolvió un texto inválido.');
  return value;
}
const list = value => {
  if (!Array.isArray(value)) throw new Error('El servicio devolvió una lista con formato inválido.');
  return value;
};

export function normalizeFire(value) {
  const f = record(value);
  const fireId = id(f.id);
  const frp = number(f.max_frp ?? f.maxFrp ?? 0, 'potencia FRP', 0);
  const timestamp = f.last_detected_at ?? f.lastDetectedAt;
  return { ...f, id: fireId, name: text(f.name, `Incendio #${fireId}`),
    country: text(f.country ?? f.country_hint ?? f.countryHint, 'Sin país'),
    centroid_lat: number(f.centroid_lat ?? f.centroidLat, 'latitud', -90, 90),
    centroid_lon: number(f.centroid_lon ?? f.centroidLon, 'longitud', -180, 180),
    max_frp: frp, detection_count: number(f.detection_count ?? f.detectionCount ?? 0, 'detecciones', 0, Number.MAX_SAFE_INTEGER, true),
    last_detected_at: typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)) ? timestamp : null,
    level: frp > 150 ? 'Crítico' : frp > 90 ? 'Alto' : frp > 30 ? 'Moderado' : 'Bajo' };
}
export function normalizeCity(value) {
  const c = record(value);
  return { ...c, id: id(c.id), name: text(c.name, 'Ciudad sin nombre'),
    country: text(c.country ?? c.country_code, 'Sin país'),
    latitude: number(c.latitude, 'latitud', -90, 90), longitude: number(c.longitude, 'longitud', -180, 180),
    population: c.population == null ? null : number(c.population, 'población', 0, Number.MAX_SAFE_INTEGER, true),
    ...(c.distance_km !== undefined ? { distance_km: number(c.distance_km, 'distancia', 0) } : {}) };
}
function normalizeWeather(value) {
  const w = record(value);
  return { ...w, city_id: id(w.city_id), city_name: text(w.city_name, `Ciudad ${w.city_id}`),
    temperature_c: w.temperature_c == null ? null : number(w.temperature_c, 'temperatura'),
    wind_speed_kmh: w.wind_speed_kmh == null ? null : number(w.wind_speed_kmh, 'velocidad del viento', 0),
    wind_direction_deg: w.wind_direction_deg == null ? null : number(w.wind_direction_deg, 'dirección del viento', 0, 360) };
}

export function createApi(env, fetcher = (...args) => fetch(...args)) {
  const { bases, demo } = readConfig(env);
  async function request(service, path, fixture) {
    if (demo) return { data: structuredClone(fixture), source: 'demo' };
    let response;
    try {
      response = await fetcher(`${bases[service]}${path}`, { signal: AbortSignal.timeout(10000) });
    } catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw new Error(`MS${service} tardó demasiado en responder. Intenta de nuevo.`);
      throw new Error(`No se pudo conectar con MS${service}. Comprueba que el servicio esté encendido.`);
    }
    if (!response.ok) {
      let detail;
      try { const body = await response.json(); detail = body.detail ?? body.error; } catch { /* Sin cuerpo JSON. */ }
      throw new Error(`MS${service}: HTTP ${response.status}${typeof detail === 'string' ? ` — ${detail}` : ''}`);
    }
    try { return { data: await response.json(), source: 'api' }; }
    catch { throw new Error(`MS${service} devolvió una respuesta que no es JSON válido.`); }
  }
  return {
    async fires(page = 0) {
      number(page, 'página', 0, Number.MAX_SAFE_INTEGER, true);
      const r = await request(1, `/api/v1/fires?page=${page}&size=100`, {
        content: fires.slice(page * 100, (page + 1) * 100), totalPages: Math.ceil(fires.length / 100), totalElements: fires.length,
      });
      const data = record(r.data);
      return { ...r, data: list(data.content).map(normalizeFire), pagination: {
        page, totalPages: number(data.totalPages, 'páginas', 0, Number.MAX_SAFE_INTEGER, true),
        totalElements: number(data.totalElements, 'total de eventos', 0, Number.MAX_SAFE_INTEGER, true),
      } };
    },
    async fire(value) {
      const key = id(value);
      const r = await request(1, `/api/v1/fires/${key}`, fires.find(f => f.id === key));
      if (!r.data) throw new Error('Incendio no encontrado.');
      return { ...r, data: normalizeFire(r.data) };
    },
    async cities() {
      const r = await request(2, '/api/cities?limit=100', cities);
      return { ...r, data: list(r.data).map(normalizeCity) };
    },
    async city(value) {
      const key = id(value);
      const r = await request(2, `/api/cities/${key}`, cities.find(c => c.id === key));
      if (!r.data) throw new Error('Ciudad no encontrada.');
      return { ...r, data: normalizeCity(r.data) };
    },
    async weather() {
      const r = await request(3, '/api/weather', { data: weather });
      return { ...r, data: list(record(r.data).data).map(normalizeWeather) };
    },
    async cityWeather(value) {
      const key = id(value);
      const r = await request(3, `/api/weather/city/${key}`, { readings: weather.filter(w => w.city_id === key) });
      return { ...r, data: { ...record(r.data), readings: list(r.data.readings).map(normalizeWeather) } };
    },
    async risk() {
      const r = await request(4, '/api/risk/preview', { alerts: risks, note: 'Escenario de exposición simulado.' });
      if (demo) return r;
      const data = record(r.data);
      return { ...r, data: { ...data, fire: data.fire === null ? null : normalizeFire(data.fire),
        note: text(data.note, 'Vista preliminar; el cálculo de riesgo está pendiente.'),
        nearby_cities: list(data.nearby_cities).map(normalizeCity) } };
    },
    async riskDetail(value) {
      const key = id(value);
      if (!demo) throw new Error('La evaluación detallada de riesgo todavía no está disponible.');
      const data = risks.find(r => r.id === key);
      if (!data) throw new Error('Evaluación no encontrada.');
      return { data: structuredClone(data), source: 'demo' };
    },
    async analytics() {
      const r = await request(5, '/api/analytics/status', {
        status: 'demo', note: 'Distribución simulada de detecciones.', athena_enabled: false,
      });
      const data = record(r.data);
      return { ...r, data: { ...data, status: text(data.status, 'pending'),
        note: text(data.note, 'Consultas analíticas pendientes de implementación.'),
        summary: demo ? structuredClone(analytics) : null } };
    },
  };
}

// En Node (pruebas) no existe import.meta.env. En Vite la configuración es obligatoria.
const env = import.meta.env ?? { VITE_DEMO_MODE: 'true' };
export const { bases, demo: demoMode } = readConfig(env);
export const api = createApi(env);
