import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabase/client";
import { LayoutDashboard, Wrench, ShoppingCart, Package, Users, LogOut, Cpu, Monitor, DollarSign, Briefcase } from "lucide-react"; // Asegúrate de tener Briefcase si lo agregaste antes

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Taller", path: "/taller", icon: Wrench },
  { name: "Equipos", path: "/equipos", icon: Monitor },
  { name: "POS", path: "/pos", icon: ShoppingCart },
  { name: "Inventario", path: "/inventario", icon: Package },
  { name: "Flujo de Caja", path: "/flujo-caja", icon: DollarSign },
  { name: "RRHH & Pagos", path: "/remuneraciones", icon: Briefcase },
  { name: "Clientes", path: "/clientes", icon: Users },
];

export default function Sidebar({ isCollapsed }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login");
    } catch (error) {
      console.error("Error al salir:", error.message);
      alert("Hubo un error al intentar cerrar sesión");
    }
  };

  return (
    <div className={`h-screen bg-brand-dark border-r border-white/10 flex flex-col fixed left-0 top-0 z-50 shadow-xl font-sans transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>

      {/* ZONA DEL LOGO (TEXTO MÁS PEQUEÑO) */}
      <div className={`p-6 flex flex-col items-center justify-center text-center mb-1 transition-all ${isCollapsed ? 'px-2' : 'px-6'}`}>
        <Cpu size={isCollapsed ? 20 : 28} className="text-brand-purple mb-2 animate-pulse" />
        {!isCollapsed && (
          <div className="animate-in fade-in duration-500">
            <div className="leading-none">
              {/* CAMBIO: De text-3xl a text-xl */}
              <h1 className="text-xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-cyan drop-shadow-[0_0_10px_rgba(203,94,238,0.5)]">
                TÉCNICO
              </h1>
              {/* CAMBIO: De text-xl a text-xs */}
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white mt-0.5 shadow-black drop-shadow-md">
                COMPUTÍN
              </h2>
            </div>
            <div className="w-8 h-1 bg-brand-gradient rounded-full mt-2 shadow-[0_0_10px_rgba(75,225,236,0.5)] mx-auto"></div>
          </div>
        )}
      </div>

      {/* MENÚ (Scroll oculto visualmente pero funcional) */}
      <nav className="flex-1 px-3 space-y-1.5 mt-2 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 font-medium group text-sm ${isActive // CAMBIO: text-sm añadido
                ? "bg-brand-gradient text-white shadow-lg shadow-brand-purple/20"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
              } ${isCollapsed ? 'justify-center' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={18} // CAMBIO: Icono un poco más pequeño (de 20 a 18)
                  className={isActive ? "text-white" : "group-hover:text-brand-cyan transition-colors"}
                />
                {!isCollapsed && <span className="animate-in fade-in slide-in-from-left-2">{item.name}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* BOTÓN SALIR */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white w-full transition-all rounded-lg hover:bg-red-500/10 group ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
          {!isCollapsed && <span className="font-bold uppercase tracking-widest text-[9px]">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
}