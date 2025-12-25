import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner"; 

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login"; // 👈 Solo importamos este Login
import Inventario from "./pages/Inventario";
import Clientes from "./pages/Clientes";
import Equipos from "./pages/Equipos";
import Pos from "./pages/Pos";
import Taller from "./pages/Taller";
import FlujoCaja from "./pages/FlujoCaja";
import PortalTecnico from "./pages/PortalTecnico";
import Tracker from "./pages/Tracker";
import ProtectedRoute from "./components/ProtectedRoute";
import Remuneraciones from "./pages/Remuneraciones";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" closeButton />
      
      <Routes>
        {/* Ruta única de Login */}
        <Route path="/login" element={<Login />} />
        
        {/* ELIMINAR la ruta /login-tecnico */}

        {/* Rutas Administrativas */}
        <Route path="/" element={<ProtectedRoute requiredRole="admin"><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/flujo-caja" element={<ProtectedRoute requiredRole="admin"><Layout><FlujoCaja /></Layout></ProtectedRoute>} />
        <Route path="/taller" element={<ProtectedRoute requiredRole="admin"><Layout><Taller /></Layout></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute requiredRole="admin"><Layout><Pos /></Layout></ProtectedRoute>} />
        <Route path="/inventario" element={<ProtectedRoute requiredRole="admin"><Layout><Inventario /></Layout></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute requiredRole="admin"><Layout><Clientes /></Layout></ProtectedRoute>} />
        <Route path="/equipos" element={<ProtectedRoute requiredRole="admin"><Layout><Equipos /></Layout></ProtectedRoute>} />
        <Route path="/remuneraciones" element={<ProtectedRoute requiredRole="admin"><Layout><Remuneraciones /></Layout></ProtectedRoute>} />
        <Route path="/tracker/:orderId" element={<Tracker />} />
        {/* Portal Técnico (Protegido pero accesible por rol tecnico) */}
        <Route path="/portal-tecnico" element={<ProtectedRoute requiredRole="tecnico"><PortalTecnico /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;