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
    assert.equal(url,'http://127.0.0.1:8085/api/v1/analytics/status');
    return ok({status:'pending',athena_enabled:false,note:'Pendiente'});
  });
  const r=await api.analytics();assert.equal(r.source,'api');assert.equal(r.data.summary,null);
});
test('riesgo maneja catálogo vacío y no consulta rutas inexistentes', async () => {
  const api=createApi(env,async url=>{
    assert.match(url,/http:\/\/127\.0\.0\.1:8084\/api\/v1\/risk/);
    if (url.endsWith('/preview')) return ok({fire:null,nearby_cities:[],alerts:[],note:'Sin incendios'});
    return ok({id:1,name:'Lima',level:'Bajo',risk_score:10});
  });
  assert.equal((await api.risk()).data.fire,null);
  assert.equal((await api.riskDetail(1)).data.level,'Bajo');
});

test('carga las 1300 ciudades entre páginas y conserva todos los países', async () => {
  const countries=['Guyana','Perú','Chile','Argentina','Brasil','Bolivia','Colombia','Ecuador','Paraguay','Suriname','Uruguay','Venezuela','French Guiana'];
  const rows=Array.from({length:1300},(_,i)=>({id:i+1,name:`Ciudad ${i}`,country:countries[Math.floor(i/100)],latitude:-12,longitude:-77,population:null}));
  const offsets=[];
  const api=createApi(env,async url=>{
    const params=new URL(url).searchParams;
    const page=Number(params.get('page')),limit=Number(params.get('size'));
    assert.equal(limit,500);offsets.push(page*limit);
    return ok(rows.slice(page*limit,page*limit+limit));
  });
  const result=await api.cities();
  assert.deepEqual(offsets,[0,500,1000]);
  assert.equal(result.data.length,1300);
  assert.equal(new Set(result.data.map(c=>c.country)).size,13);
  assert.equal(new Set(result.data.map(c=>c.id)).size,1300);
});

test('ciudades no presenta un catálogo parcial si falla una página posterior', async () => {
  const rows=Array.from({length:500},(_,i)=>({id:i+1,name:'Ciudad',latitude:0,longitude:0}));
  let calls=0;
  const api=createApi(env,async()=>++calls===1?ok(rows):({ok:false,status:503,json:async()=>({})}));
  await assert.rejects(api.cities(), /HTTP 503/);
});

test('ciudades detecta páginas repetidas y maneja catálogos vacíos y demo', async () => {
  const rows=Array.from({length:500},(_,i)=>({id:i+1,name:'Ciudad',latitude:0,longitude:0}));
  await assert.rejects(createApi(env,async()=>ok(rows)).cities(), /catálogo.*cambió/);
  assert.deepEqual((await createApi(env,async()=>ok([])).cities()).data,[]);
  assert.ok((await createApi({VITE_DEMO_MODE:'true'},()=>assert.fail()).cities()).data.length);
});

test('envía filtros globales a MS1 y conserva los totales filtrados', async () => {
  const api=createApi(env,async url=>{
    const params=new URL(url).searchParams;
    assert.equal(params.get('page'),'2');
    assert.equal(params.get('country'),'Perú');
    assert.equal(params.get('severity'),'Bajo');
    assert.equal(params.get('q'),'Incendio #106');
    return ok({content:[{...fire,maxFrp:20}],totalPages:4,totalElements:350});
  });
  const result=await api.fires(2,{country:'Perú',severity:'Bajo',q:' Incendio #106 '});
  assert.equal(result.pagination.totalElements,350);
  assert.equal(result.data[0].level,'Bajo');
});

test('catálogo de países independiente de los incendios de la página', async () => {
  const result=await createApi(env,async url=>{
    assert.equal(new URL(url).pathname,'/api/v1/fires/countries');
    return ok(['Chile','Guyana','Perú']);
  }).fireCountries();
  assert.deepEqual(result.data,['Chile','Guyana','Perú']);
});

test('demo filtra antes de calcular el total y paginar', async () => {
  const api=createApi({VITE_DEMO_MODE:'true'});
  const all=await api.fires();
  const country=all.data[0].country;
  const filtered=await api.fires(0,{country});
  assert.ok(filtered.data.every(f=>f.country===country));
  assert.equal(filtered.pagination.totalElements,all.data.filter(f=>f.country===country).length);
  const empty=await api.fires(0,{q:'inexistente'});
  assert.equal(empty.pagination.totalElements,0);
});

test('atmósfera pagina localidades únicas y envía el filtro de país', async () => {
  const api=createApi(env,async url=>{
    const params=new URL(url).searchParams;
    assert.equal(new URL(url).pathname,'/api/v1/weather/overview');
    assert.equal(params.get('page'),'1');
    assert.equal(params.get('size'),'48');
    assert.equal(params.get('country'),'Perú');
    assert.equal(params.get('city'),'Lima');
    return ok({data:[{city_id:7,city_name:'Lima',city_country:'Perú'}],total:100,countries:['Guyana','Perú']});
  });
  const r=await api.weatherOverview(1,'Perú','Lima');
  assert.equal(r.pagination.totalPages,3);
  assert.equal(r.pagination.totalElements,100);
  assert.equal(r.data[0].city_id,7);
});

test('atmósfera demo no duplica tarjetas de ciudad', async () => {
  const r=await createApi({VITE_DEMO_MODE:'true'}).weatherOverview();
  assert.equal(new Set(r.data.map(w=>w.city_id)).size,r.data.length);
});
