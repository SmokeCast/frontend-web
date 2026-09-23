import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import App from './App.jsx';
import 'leaflet/dist/leaflet.css';
import './style.css';
function RoutedApp(){
  return <Routes>
    <Route path="/" element={<App/>}/>
    <Route path="/incendios" element={<App/>}/>
    <Route path="/ciudades" element={<App/>}/>
    <Route path="/atmosfera" element={<App/>}/>
    <Route path="/riesgo" element={<App/>}/>
    <Route path="/analitica" element={<App/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><RoutedApp/></BrowserRouter></React.StrictMode>);
