import { useState } from "react";
import { supabase } from "../supabase/client";
import { useNavigate } from "react-router-dom";
import { KeyRound, Mail, Loader2, Wrench, Cpu, LayoutDashboard } from "lucide-react";

export default function LoginTecnico() {
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
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Check if user has technician or admin role
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .single();

            if (profile?.role === "tecnico" || profile?.role === "coordinador" || profile?.role === "admin") {
                navigate("/portal-tecnico");
            } else {
                await supabase.auth.signOut();
                setErrorMsg("No tienes permisos de técnico.");
            }
        } catch (error) {
            setErrorMsg("Credenciales incorrectas o error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
            {/* BACKGROUND ELEMENTS */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-purple/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-cyan/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative z-10 transition-all duration-500">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-10 rounded-[3rem] shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-brand-gradient rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-purple/20 rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Wrench className="text-white" size={40} />
                        </div>
                        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Technical Portal</h1>
                        <p className="text-slate-500 text-sm font-medium tracking-wide">Área exclusiva para personal técnico</p>
                    </div>

                    {errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 text-xs font-bold text-center uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-left">Correo de Técnico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-purple transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-brand-purple/50 focus:ring-4 focus:ring-brand-purple/5 transition-all text-sm"
                                    placeholder="ejemplo@tecnico.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-left">Contraseña</label>
                            <div className="relative group">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-purple transition-colors" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-brand-purple/50 focus:ring-4 focus:ring-brand-purple/5 transition-all text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-gradient text-white font-black py-4 rounded-2xl shadow-2xl shadow-brand-purple/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all uppercase tracking-[0.2em] italic text-sm mt-8"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    <span>Entrar al Sistema</span>
                                    <Cpu size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                        <button
                            onClick={() => navigate("/login")}
                            className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <LayoutDashboard size={14} /> Acceso Administrativo
                        </button>
                        <p className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">&copy; 2025 Técnico Computín S.A.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
