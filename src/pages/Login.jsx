import { useState } from "react";
import { supabase } from "../supabase/client";
import { useNavigate } from "react-router-dom";
import { KeyRound, Mail, Loader2, Cpu, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Autenticar usuario con Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Obtener Rol del Usuario desde la tabla 'profiles'
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError) throw profileError;

      // 3. Redirección Inteligente según Rol
      const role = profile?.role;

      if (role === "admin") {
        navigate("/"); // Dashboard General (Admin)
      } else if (role === "tecnico" || role === "coordinador") {
        navigate("/portal-tecnico"); // Portal Técnico
      } else {
        // Rol desconocido o usuario básico sin acceso
        await supabase.auth.signOut();
        setErrorMsg("No tienes permisos asignados. Contacta al administrador.");
      }

    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg("Credenciales incorrectas o error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos de Fondo Ambientales */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-purple/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-cyan/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-purple/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Cpu className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">
            Técnico Computín
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Sistema de Gestión Integral
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 text-xs font-bold text-center uppercase tracking-wide animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <ShieldCheck size={16} />
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Corporativo</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-cyan transition-colors" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all text-sm font-medium placeholder-slate-600"
                placeholder="usuario@tecnico.cl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-purple transition-colors" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all text-sm font-medium placeholder-slate-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gradient text-white font-black py-4 rounded-xl shadow-lg shadow-brand-purple/20 hover:opacity-90 hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-xs mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Iniciar Sesión"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            v2.0 Stable • Acceso Seguro
          </p>
        </div>
      </div>
    </div>
  );
}