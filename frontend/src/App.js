/**
 * JSON2VIDEO Cloud Studio - Aplicación Principal
 * 
 * Editor de video profesional con arquitectura cloud-native
 * Versión simplificada manteniendo solo el Cloud Editor
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CloudVideoEditor from './components/CloudVideoEditor';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Redirigir a cloud studio por defecto */}
          <Route path="/" element={<Navigate to="/cloud" replace />} />
          
          {/* Cloud Studio - Editor Principal */}
          <Route path="/cloud" element={<CloudVideoEditor />} />
          <Route path="/studio" element={<CloudVideoEditor />} />
          
          {/* Rutas legacy redirigidas al Cloud Editor */}
          <Route path="/editor" element={<Navigate to="/cloud" replace />} />
          <Route path="/advanced" element={<Navigate to="/cloud" replace />} />
          <Route path="/basic" element={<Navigate to="/cloud" replace />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/cloud" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 