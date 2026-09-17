import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api,bases,normalizeFire,request} from './api.js';
test('adapta contratos snake_case y camelCase de Fire Catalog',()=>{
 const a=normalizeFire({id:3,centroidLat:-8,centroidLon:-74,maxFrp:160,detectionCount:12,countryHint:'PE'});
 assert.equal(a.centroid_lat,-8);assert.equal(a.max_frp,160);assert.equal(a.level,'Crítico');assert.equal(a.country,'PE');
 const b=normalizeFire({id:4,centroid_lat:'-12.2',centroid_lon:'-69.2',max_frp:'50',detection_count:'8'});assert.equal(b.detection_count,8);assert.equal(b.level,'Moderado');
});
test('demo permite lista y detalle sin hacer peticiones de red',async()=>{
 const r=await api.fires();assert.equal(r.source,'demo');assert.ok(r.data.length);
 const detail=await api.fire(r.data[0].id);assert.equal(detail.data.id,r.data[0].id);
 const weather=await api.cityWeather(1);assert.equal(weather.data.readings[0].city_id,1);
});
test('API configurada utiliza URL correcta y no oculta errores con mocks',async()=>{
 bases[1]='https://example.test';
 try{
 const r=await request(1,'/api/fires',[],async url=>{assert.equal(url,'https://example.test/api/fires');return {ok:true,json:async()=>[{id:9}]};});assert.equal(r.source,'api');assert.equal(r.data[0].id,9);
 await assert.rejects(request(1,'/api/fires',[],async()=>({ok:false,status:503})),/HTTP 503/);
 }finally{bases[1]='';}
});
