import { NavLink, useNavigate } from "react-router-dom"; // Importamos useNavigate
import { supabase } from "../supabase/client"; // Importamos el cliente de Supabase
import { LayoutDashboard, Wrench, ShoppingCart, Package, Users, LogOut, Cpu, Monitor, DollarSign, ClipboardCheck } from "lucide-react";

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Taller", path: "/taller", icon: Wrench },
  { name: "Equipos", path: "/equipos", icon: Monitor },
  { name: "POS", path: "/pos", icon: ShoppingCart },
  { name: "Inventario", path: "/inventario", icon: Package },
  { name: "Flujo de Caja", path: "/flujo-caja", icon: DollarSign },
  { name: "Clientes", path: "/clientes", icon: Users },
];

export default function Sidebar({ isCollapsed }) {
  const navigate = useNavigate();

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Una vez cerrada la sesión, mandamos al usuario al Login
      navigate("/login");
    } catch (error) {
      console.error("Error al salir:", error.message);
      alert("Hubo un error al intentar cerrar sesión");
    }
  };

  return (
    <div className={`h-screen bg-brand-dark border-r border-white/10 flex flex-col fixed left-0 top-0 z-50 shadow-xl font-sans transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>

      {/* ZONA DEL LOGO (TEXTO CYBER) */}
      <div className={`p-8 flex flex-col items-center justify-center text-center mb-2 transition-all ${isCollapsed ? 'px-2' : 'px-8'}`}>
        <Cpu size={isCollapsed ? 24 : 32} className="text-brand-purple mb-2 animate-pulse" />
        {!isCollapsed && (
          <div className="animate-in fade-in duration-500">
            <div className="leading-none">
              <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-cyan drop-shadow-[0_0_10px_rgba(203,94,238,0.5)]">
                TÉCNICO
              </h1>
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-white -mt-1 shadow-black drop-shadow-md">
                COMPUTÍN
              </h2>
            </div>
            <div className="w-12 h-1 bg-brand-gradient rounded-full mt-3 shadow-[0_0_10px_rgba(75,225,236,0.5)] mx-auto"></div>
          </div>
        )}
      </div>

      {/* MENÚ */}
      <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium group ${isActive
                ? "bg-brand-gradient text-white shadow-lg shadow-brand-purple/20"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
              } ${isCollapsed ? 'justify-center' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={20}
                  className={isActive ? "text-white" : "group-hover:text-brand-cyan transition-colors"}
                />
                {!isCollapsed && <span className="animate-in fade-in slide-in-from-left-2">{item.name}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* BOTÓN SALIR (FUNCIONAL) */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white w-full transition-all rounded-xl hover:bg-red-500/10 group ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
          {!isCollapsed && <span className="font-bold uppercase tracking-widest text-[10px]">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
}