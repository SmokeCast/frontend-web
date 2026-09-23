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
export function normalizeSensitiveSite(value) {
  const s = record(value);
  return { ...s, id: id(s.id), city_id: id(s.city_id ?? s.cityId), name: text(s.name, 'Sitio sensible'), type: text(s.type, 'Otro') };
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
  async function request(service, path, fixture, options = {}) {
    if (demo) return { data: structuredClone(fixture), source: 'demo' };
    let response;
    try {
      response = await fetcher(`${bases[service]}${path}`, { signal: AbortSignal.timeout(10000), ...options });
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
    async fires(page = 0, {country = '', severity = '', q = ''} = {}) {
      number(page, 'página', 0, Number.MAX_SAFE_INTEGER, true);
      const params = new URLSearchParams();
      if (country) params.set('country', country);
      if (severity) params.set('severity', severity);
      if (q.trim()) params.set('q', q.trim());
      const suffix = params.size ? `&${params}` : '';
      const term = q.trim().toLowerCase();
      const numeric = term.replace(/^incendio\s*#?\s*/, '').replace(/^#/, '');
      const filtered = fires.map(normalizeFire).filter(f => (!country || f.country.toLowerCase() === country.toLowerCase()) &&
        (!severity || f.level === severity) && (!term || f.country.toLowerCase().includes(term) || String(f.id) === numeric));
      const r = await request(1, `/api/v1/fires?page=${page}&size=100${suffix}`, {
        content: filtered.slice(page * 100, (page + 1) * 100), totalPages: Math.ceil(filtered.length / 100), totalElements: filtered.length,
      });
      const data = record(r.data);
      return { ...r, data: list(data.content).map(normalizeFire), pagination: {
        page, totalPages: number(data.totalPages, 'páginas', 0, Number.MAX_SAFE_INTEGER, true),
        totalElements: number(data.totalElements, 'total de eventos', 0, Number.MAX_SAFE_INTEGER, true),
      } };
    },
    async fireCountries() {
      const r = await request(1, '/api/v1/fires/countries', [...new Set(fires.map(f => normalizeFire(f).country))].sort());
      return { ...r, data: list(r.data).map(c => text(c, 'Sin país')) };
    },
    async fire(value) {
      const key = id(value);
      const r = await request(1, `/api/v1/fires/${key}`, fires.find(f => f.id === key));
      if (!r.data) throw new Error('Incendio no encontrado.');
      return { ...r, data: normalizeFire(r.data) };
    },
    async cities() {
      const data = [];
      const seen = new Set();
      const limit = 500;
      for (let offset = 0; ; offset += limit) {
        const r = await request(2, `/api/v1/cities?page=${offset / limit}&size=${limit}`, cities.slice(offset, offset + limit));
        const batch = list(r.data).map(normalizeCity);
        for (const city of batch) {
          if (seen.has(city.id)) throw new Error('El catálogo de ciudades cambió durante la carga. Actualiza para volver a consultar.');
          seen.add(city.id);
          data.push(city);
        }
        if (batch.length < limit) return { ...r, data: data.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id - b.id) };
      }
    },
    async city(value) {
      const key = id(value);
      const r = await request(2, `/api/v1/cities/${key}`, cities.find(c => c.id === key));
      if (!r.data) throw new Error('Ciudad no encontrada.');
      return { ...r, data: normalizeCity(r.data) };
    },
    async sensitiveSites(cityId) {
      const key = id(cityId);
      const r = await request(2, `/api/v1/cities/${key}/sensitive-sites`, []);
      return { ...r, data: list(r.data).map(normalizeSensitiveSite) };
    },
    async weatherOverview(page = 0, country = '', city = '') {
      number(page, 'página', 0, Number.MAX_SAFE_INTEGER, true);
      const latest = new Map();
      for (const w of weather) {
        if (!latest.has(w.city_id) || w.timestamp > latest.get(w.city_id).timestamp) latest.set(w.city_id, w);
      }
      const all = [...latest.values()].map(w => ({...w, city_country: w.city_country || cities.find(c=>c.id===w.city_id)?.country || 'Sin país'}));
      const normalizedCity = city.trim().toLocaleLowerCase();
      const filtered = all.filter(w=>!country || w.city_country===country).filter(w=>!normalizedCity || w.city_name.toLocaleLowerCase().includes(normalizedCity)).sort((a,b)=>a.city_name.localeCompare(b.city_name));
      const r = await request(3, `/api/v1/weather/overview?page=${page}&size=48&country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}`, {
        data: filtered.slice(page*48,(page+1)*48), total: filtered.length, countries:[...new Set(all.map(w=>w.city_country))].sort(),
      });
      const body = record(r.data);
      const total = number(body.total, 'total de localidades', 0, Number.MAX_SAFE_INTEGER, true);
      return {...r, data:list(body.data).map(normalizeWeather), countries:list(body.countries),
        pagination:{totalElements:total,totalPages:Math.ceil(total/48)}};
    },
    async weather() {
      const r = await request(3, '/api/v1/weather', { data: weather });
      return { ...r, data: list(record(r.data).data).map(normalizeWeather) };
    },
    async cityWeather(value) {
      const key = id(value);
      const r = await request(3, `/api/v1/weather/city/${key}`, { readings: weather.filter(w => w.city_id === key) });
      return { ...r, data: { ...record(r.data), readings: list(r.data.readings).map(normalizeWeather) } };
    },
    async risk(fireId) {
      const path = fireId ? `/api/v1/risk/preview?fire_id=${encodeURIComponent(id(fireId))}` : '/api/v1/risk/preview';
      const r = await request(4, path, { alerts: risks, note: 'Escenario de exposición simulado.' });
      if (demo) return r;
      const data = record(r.data);
      return { ...r, data: { ...data, fire: data.fire === null ? null : normalizeFire(data.fire),
        note: text(data.note, 'Vista preliminar; el cálculo de riesgo está pendiente.'),
        nearby_cities: list(data.nearby_cities).map(normalizeCity) } };
    },
    async riskDetail(value, fireId) {
      const key = id(value);
      if (!demo) {
        const suffix = fireId ? `?fire_id=${encodeURIComponent(id(fireId))}` : '';
        const r = await request(4, `/api/v1/risk/${key}${suffix}`);
        return { ...r, data: record(r.data) };
      }
      const data = risks.find(r => r.id === key);
      if (!data) throw new Error('Evaluación no encontrada.');
      return { data: structuredClone(data), source: 'demo' };
    },
    async analytics() {
      const r = await request(5, '/api/v1/analytics/status', {
        status: 'demo', note: 'Distribución simulada de detecciones.', athena_enabled: false,
      });
      const data = record(r.data);
      return { ...r, data: { ...data, status: text(data.status, 'pending'),
        note: text(data.note, 'Consultas analíticas pendientes de implementación.'),
        summary: demo ? structuredClone(analytics) : null } };
    },
    async analyticsReports() {
      const r = await request(5, '/api/v1/analytics/reports', { reports: [], views: [] });
      const data = record(r.data);
      return { ...r, data: { reports: list(data.reports), views: list(data.views) } };
    },
    async analyticsQuery(report, country = '') {
      if (typeof report !== 'string' || !report) throw new Error('Reporte analítico inválido.');
      return request(5, '/api/v1/analytics/queries', {}, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({report, ...(country ? {country} : {})}),
      });
    },
    async analyticsQueryStatus(queryId) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(queryId))) throw new Error('ID de consulta analítica inválido.');
      return request(5, `/api/v1/analytics/queries/${queryId}`, {});
    },
    async analyticsResults(queryId, nextToken = '') {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(queryId))) throw new Error('ID de consulta analítica inválido.');
      const suffix = nextToken ? `?next_token=${encodeURIComponent(nextToken)}` : '';
      return request(5, `/api/v1/analytics/queries/${queryId}/results${suffix}`, {});
    },
  };
}

// En Node (pruebas) no existe import.meta.env. En Vite la configuración es obligatoria.
const env = import.meta.env ?? { VITE_DEMO_MODE: 'true' };
export const { bases, demo: demoMode } = readConfig(env);
export const api = createApi(env);
