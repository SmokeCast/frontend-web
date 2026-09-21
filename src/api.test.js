import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, normalizeFire, normalizeCity } from './api.js';
import { readConfig } from './config.js';

const env = Object.fromEntries([1,2,3,4,5].map(n => [`VITE_MS${n}_URL`, `http://127.0.0.1:${8080+n}`]));
const fire = { id:3, centroidLat:-8, centroidLon:-74, maxFrp:160, detectionCount:12, countryHint:'PE' };
const ok = data => ({ ok:true, json:async()=>data });

test('exige URLs en modo real y valida protocolo, rutas y credenciales', () => {
  assert.throws(()=>readConfig({}), /VITE_MS1_URL/);
  for (const url of ['', 'localhost:8081', 'ftp://host', 'https://host/api', 'https://user:pass@host', 'https://host?key=x']) {
    assert.throws(()=>readConfig({...env,VITE_MS1_URL:url}), /VITE_MS1_URL/);
  }
  assert.throws(()=>readConfig({...env,VITE_DEMO_MODE:'yes'}), /VITE_DEMO_MODE/);
  assert.equal(readConfig({...env,VITE_MS1_URL:' http://127.0.0.1:8081/ '}).bases[1], 'http://127.0.0.1:8081');
});
test('adapta contratos snake_case y camelCase de Fire Catalog', () => {
  const a=normalizeFire(fire);
  assert.equal(a.centroid_lat,-8);assert.equal(a.max_frp,160);assert.equal(a.level,'Crítico');assert.equal(a.country,'PE');
  const b=normalizeFire({id:4,centroid_lat:'-12.2',centroid_lon:'-69.2',max_frp:'50',detection_count:'8'});
  assert.equal(b.detection_count,8);assert.equal(b.level,'Moderado');
});
test('rechaza registros que romperían el mapa o las métricas', () => {
  for (const update of [{centroidLat:91},{centroidLon:-181},{centroidLat:null},{maxFrp:-1},{detectionCount:1.5},{id:0}]) {
    assert.throws(()=>normalizeFire({...fire,...update}), /inválido/);
  }
  assert.equal(normalizeFire({...fire,lastDetectedAt:'fecha inválida'}).last_detected_at,null);
});
test('normaliza ciudades reales y conserva población desconocida', () => {
  const city=normalizeCity({id:1,name:'Lima',country:'PE',latitude:'-12',longitude:'-77',population:null});
  assert.equal(city.country,'PE');assert.equal(city.latitude,-12);assert.equal(city.population,null);
  assert.throws(()=>normalizeCity({...city,population:-1}), /población/);
});
test('demo explícita permite navegar sin ninguna petición de red', async () => {
  const api=createApi({VITE_DEMO_MODE:'true'},()=>assert.fail('No debe consultar la red'));
  const r=await api.fires();assert.equal(r.source,'demo');assert.ok(r.data.length);
  assert.equal((await api.fire(r.data[0].id)).data.id,r.data[0].id);
  assert.equal((await api.cityWeather(1)).data.readings[0].city_id,1);
  assert.ok((await api.analytics()).data.summary.length);
});
test('consulta ruta versionada y paginación de MS1', async () => {
  const api=createApi(env,async url=>{
    assert.equal(url,'http://127.0.0.1:8081/api/v1/fires?page=2&size=100');
    return ok({content:[fire],totalPages:3,totalElements:201});
  });
  const r=await api.fires(2);assert.equal(r.data[0].id,3);assert.equal(r.pagination.totalElements,201);
});
test('rechaza IDs y páginas inválidos antes de enviar peticiones', async () => {
  const api=createApi(env,()=>assert.fail('No debe consultar la red'));
  for (const value of [0,-1,'',null,1.5,'1/../../other']) await assert.rejects(api.fire(value), /ID/);
  await assert.rejects(api.fires(-1), /página/);
});
test('no oculta errores HTTP, de red o timeout con datos demo', async () => {
  await assert.rejects(createApi(env,async()=>({ok:false,status:503,json:async()=>({detail:'Base no disponible'})})).fire(1), /HTTP 503.*Base no disponible/);
  await assert.rejects(createApi(env,async()=>{throw new TypeError('Failed to fetch');}).fire(1), /No se pudo conectar con MS1/);
  await assert.rejects(createApi(env,async()=>{throw Object.assign(new Error(),{name:'TimeoutError'});}).fire(1), /tardó demasiado/);
});
test('detecta JSON y contratos inesperados', async () => {
  await assert.rejects(createApi(env,async()=>({ok:true,json:async()=>{throw new SyntaxError();}})).fire(1), /JSON válido/);
  await assert.rejects(createApi(env,async()=>ok({content:null})).fires(), /lista/);
  await assert.rejects(createApi(env,async()=>ok({readings:{}})).cityWeather(1), /lista/);
});
test('analítica consulta únicamente status y no inventa resúmenes', async () => {
  const api=createApi(env,async url=>{
    assert.equal(url,'http://127.0.0.1:8085/api/analytics/status');
    return ok({status:'pending',athena_enabled:false,note:'Pendiente'});
  });
  const r=await api.analytics();assert.equal(r.source,'api');assert.equal(r.data.summary,null);
});
test('riesgo maneja catálogo vacío y no consulta rutas inexistentes', async () => {
  const api=createApi(env,async url=>{
    assert.equal(url,'http://127.0.0.1:8084/api/risk/preview');
    return ok({fire:null,nearby_cities:[],note:'Sin incendios'});
  });
  assert.equal((await api.risk()).data.fire,null);
  await assert.rejects(api.riskDetail(1), /todavía no está disponible/);
});
