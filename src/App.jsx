import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login"; // <--- Importamos Login
import Inventario from "./pages/Inventario"; // Importar arriba
import Clientes from "./pages/Clientes";
import Equipos from "./pages/Equipos";
import Pos from "./pages/Pos"; // <--- Importa el nuevo módulo
import Taller from "./pages/Taller";
import FlujoCaja from "./pages/FlujoCaja";
import PortalTecnico from "./pages/PortalTecnico";
import LoginTecnico from "./pages/LoginTecnico";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública para el Login (Sin Layout/Sidebar) */}
        <Route path="/login" element={<Login />} />
        <Route path="/login-tecnico" element={<LoginTecnico />} />

        {/* Rutas Administrativas (Requieren rol 'admin') */}
        <Route path="/" element={<ProtectedRoute requiredRole="admin"><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/flujo-caja" element={<ProtectedRoute requiredRole="admin"><Layout><FlujoCaja /></Layout></ProtectedRoute>} />
        <Route path="/taller" element={<ProtectedRoute requiredRole="admin"><Layout><Taller /></Layout></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute requiredRole="admin"><Layout><Pos /></Layout></ProtectedRoute>} />
        <Route path="/inventario" element={<ProtectedRoute requiredRole="admin"><Layout><Inventario /></Layout></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute requiredRole="admin"><Layout><Clientes /></Layout></ProtectedRoute>} />
        <Route path="/equipos" element={<ProtectedRoute requiredRole="admin"><Layout><Equipos /></Layout></ProtectedRoute>} />

        {/* Ruta del Portal Técnico (Requiere rol 'tecnico' o superior) */}
        <Route path="/portal-tecnico" element={<ProtectedRoute requiredRole="tecnico"><PortalTecnico /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;