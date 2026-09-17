export const fires = [
 {id:1,name:'Reserva de Ucayali',country:'Perú',centroid_lat:-8.6,centroid_lon:-74.3,max_frp:142.8,detection_count:38,level:'Alto',last_detected_at:'2026-09-12T13:45:00Z'},
 {id:2,name:'Chiquitanía',country:'Bolivia',centroid_lat:-16.5,centroid_lon:-60.8,max_frp:218.4,detection_count:64,level:'Crítico',last_detected_at:'2026-09-12T13:30:00Z'},
 {id:3,name:'Porto Velho',country:'Brasil',centroid_lat:-8.76,centroid_lon:-63.9,max_frp:96.2,detection_count:27,level:'Alto',last_detected_at:'2026-09-12T12:50:00Z'},
 {id:4,name:'Madre de Dios',country:'Perú',centroid_lat:-12.2,centroid_lon:-69.2,max_frp:62.5,detection_count:16,level:'Moderado',last_detected_at:'2026-09-12T12:25:00Z'},
 {id:5,name:'Mato Grosso',country:'Brasil',centroid_lat:-12.8,centroid_lon:-56.1,max_frp:185.6,detection_count:52,level:'Crítico',last_detected_at:'2026-09-12T12:10:00Z'},
 {id:6,name:'Gran Chaco',country:'Paraguay',centroid_lat:-21.1,centroid_lon:-60.4,max_frp:41.3,detection_count:12,level:'Moderado',last_detected_at:'2026-09-12T11:40:00Z'},
 {id:7,name:'Loreto',country:'Perú',centroid_lat:-4.5,centroid_lon:-73.4,max_frp:24.1,detection_count:8,level:'Bajo',last_detected_at:'2026-09-12T11:20:00Z'},
 {id:8,name:'Santa Cruz',country:'Bolivia',centroid_lat:-17.7,centroid_lon:-63.1,max_frp:78.9,detection_count:21,level:'Moderado',last_detected_at:'2026-09-12T10:55:00Z'}
];
export const cities = [{id:1,name:'Pucallpa',country_code:'PE',latitude:-8.38,longitude:-74.55,population:326040},{id:2,name:'Santa Cruz de la Sierra',country_code:'BO',latitude:-17.78,longitude:-63.18,population:1900000},{id:3,name:'Porto Velho',country_code:'BR',latitude:-8.76,longitude:-63.9,population:548952},{id:4,name:'Puerto Maldonado',country_code:'PE',latitude:-12.6,longitude:-69.18,population:85224}];
export const weather = cities.map((c,i)=>({city_id:c.id,city_name:c.name,timestamp:'2026-09-12T13:00:00Z',temperature_c:29+i,wind_speed_kmh:12+i*3,wind_direction_deg:210+i*20,pm2_5:18+i*7}));
export const risks = cities.map((c,i)=>({id:c.id,city:c.name,level:['Alto','Crítico','Moderado','Bajo'][i],eta_hours:[3,2,6,12][i],population:c.population}));
export const analytics = [{country:'Perú',detections:62},{country:'Bolivia',detections:85},{country:'Brasil',detections:79},{country:'Paraguay',detections:12}];
