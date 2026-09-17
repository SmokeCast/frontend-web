import {useEffect,useRef} from 'react';
import L from 'leaflet';
import geography from './south-america.json';
import {Plus,Minus,LocateFixed,Layers} from 'lucide-react';
const colors={Crítico:'#df5944',Alto:'#ea873f',Moderado:'#ddb349',Bajo:'#4a9875'};
export default function FireMap({fires,onSelect,layer}) {
 const node=useRef(null),map=useRef(null),markers=useRef(null),select=useRef(onSelect);
 useEffect(()=>{select.current=onSelect;},[onSelect]);
 useEffect(()=>{
 const m=L.map(node.current,{zoomControl:false,scrollWheelZoom:false,attributionControl:true}).setView([-12,-65],4);map.current=m;
 m.createPane('localBase');m.getPane('localBase').style.zIndex=150;
 L.geoJSON(geography,{pane:'localBase',style:{color:'#cbd4bd',weight:1,fillColor:'#e3e9d8',fillOpacity:1},interactive:false,attribution:'Natural Earth (dominio público)'}).addTo(m);
 const labels=[['PERÚ',-9,-76],['BRASIL',-10,-53],['BOLIVIA',-18,-65],['PARAGUAY',-23,-59],['ECUADOR',-2,-79],['COLOMBIA',5,-73]];
 labels.forEach(([name,lat,lon])=>L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'country-label',html:name,iconSize:[90,15],iconAnchor:[45,7]})}).addTo(m));
 markers.current=L.layerGroup().addTo(m);const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(node.current);
 return()=>{observer.disconnect();m.remove();};
 },[]);
 useEffect(()=>{if(!markers.current)return;markers.current.clearLayers();fires.forEach(f=>{
 if(!Number.isFinite(f.centroid_lat)||!Number.isFinite(f.centroid_lon))return;
 if(layer==='humo')L.circle([f.centroid_lat+.3,f.centroid_lon+.5],{radius:f.max_frp*800,color:colors[f.level],weight:0,fillOpacity:.13}).addTo(markers.current);
 const icon=L.divIcon({className:'fire-marker-wrap',html:`<span class="fire-marker" style="--marker:${colors[f.level] || '#ea873f'}"><span></span></span>`,iconSize:[28,28],iconAnchor:[14,14]});
 const marker=L.marker([f.centroid_lat,f.centroid_lon],{icon}).addTo(markers.current).on('click',()=>select.current(f));
 const label=document.createElement('span');label.textContent=f.name;marker.bindTooltip(label);marker.on('add',()=>{const el=marker.getElement();el?.setAttribute('aria-label',`Ver incendio: ${f.name}`);el?.setAttribute('role','button');});
 const el=marker.getElement();el?.setAttribute('aria-label',`Ver incendio: ${f.name}`);
 });},[fires,layer]);
 return <div className="map-shell"><div ref={node} className="map" aria-label="Mapa de incendios de Sudamérica"/><div className="map-caption"><span className="live-dot"/> Sudamérica <span>·</span> {fires.length} eventos visibles</div><div className="map-controls"><button aria-label="Acercar mapa" onClick={()=>map.current.zoomIn()}><Plus size={17}/></button><button aria-label="Alejar mapa" onClick={()=>map.current.zoomOut()}><Minus size={17}/></button><button aria-label="Centrar Sudamérica" onClick={()=>map.current.setView([-12,-65],4)}><LocateFixed size={17}/></button></div><div className="map-legend"><Layers size={15}/>{Object.entries(colors).map(([name,color])=><span key={name}><i style={{background:color}}/>{name}</span>)}</div>{layer==='humo'&&<div className="map-disclaimer">Área ilustrativa; no representa un pronóstico de dispersión.</div>}</div>;
}
