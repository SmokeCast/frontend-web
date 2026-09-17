import { fires, cities, weather, risks, analytics } from './data.js';
const env = import.meta.env || {};
export const bases = Object.fromEntries([1,2,3,4,5].map(n=>[n,env[`VITE_MS${n}_URL`]?.replace(/\/$/,'') || '']));
export function normalizeFire(f) { const frp=Number(f.max_frp ?? f.maxFrp ?? 0); return {...f,name:f.name || `Incendio #${f.id}`,country:f.country || f.country_hint || f.countryHint || 'Sin país',centroid_lat:Number(f.centroid_lat ?? f.centroidLat),centroid_lon:Number(f.centroid_lon ?? f.centroidLon),max_frp:frp,detection_count:Number(f.detection_count ?? f.detectionCount ?? 0),last_detected_at:f.last_detected_at ?? f.lastDetectedAt,level:f.level || (frp>150?'Crítico':frp>90?'Alto':frp>30?'Moderado':'Bajo')}; }
export async function request(service,path,mock,fetcher=fetch) {
 if(!bases[service]) return {data:structuredClone(mock),source:'demo'};
 const response=await fetcher(`${bases[service]}${path}`,{signal:AbortSignal.timeout(10000)});
 if(!response.ok) throw new Error(`Ms${service}: error HTTP ${response.status}`);
 return {data:await response.json(),source:'api'};
}
const list = (r,key) => {const data=Array.isArray(r.data)?r.data:r.data?.[key];if(!Array.isArray(data))throw new Error('La API devolvió un formato inesperado');return {...r,data};};
export const api={
 fires:async()=>{const r=list(await request(1,'/api/fires',fires));return {...r,data:r.data.map(normalizeFire)};},
 fire:async id=>{const r=await request(1,`/api/fires/${id}`,fires.find(f=>f.id===id));if(!r.data)throw new Error('Incendio no encontrado');return {...r,data:normalizeFire(r.data)};},
 cities:async()=>list(await request(2,'/api/cities',cities)),
 city:id=>request(2,`/api/cities/${id}`,cities.find(c=>c.id===id)),
 weather:async()=>list(await request(3,'/api/weather',{data:weather}),'data'),
 cityWeather:id=>request(3,`/api/weather/city/${id}`,{readings:weather.filter(w=>w.city_id===id)}),
 risk:()=>request(4,'/api/risk/preview',{alerts:risks,note:'Escenario de exposición simulado.'}),
 // Contratos propuestos: estos endpoints todavía no existen en el backend.
 riskDetail:id=>request(4,`/api/risk/city/${id}`,risks.find(r=>r.id===id)),
 analyticsStatus:()=>request(5,'/api/analytics/status',{status:'Demostración local',note:'Consultas Athena pendientes de implementación.'}),
 analytics:async()=>list(await request(5,'/api/analytics/summary',analytics)),
};
