import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase/client";
import { 
    CheckCircle2, Wrench, FileText, Star, 
    Smartphone, Laptop, AlertTriangle, Clock, 
    Activity, ChevronRight, Hash, Package, Receipt
} from "lucide-react";
import { generateOrderPDF } from "../utils/pdfGenerator";

// Link de tu negocio
const GOOGLE_REVIEW_LINK = "https://g.page/r/CepkJ5XxmVnFEAE/review";

export default function Tracker() {
    const { orderId } = useParams(); 
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [debugError, setDebugError] = useState("");

    useEffect(() => {
        const fetchOrder = async () => {
            // Buscamos orden intentando varias formas de ID
            let query = supabase
                .from('work_orders')
                .select('*, customers(phone, address, comuna)') 
                .ilike('order_id', orderId); 

            let { data, error } = await query;

            // Si falla, probamos quitando OT-
            if ((!data || data.length === 0) && orderId.toUpperCase().includes('OT-')) {
                const numberOnly = orderId.toUpperCase().replace('OT-', '');
                const retry = await supabase.from('work_orders').select('*, customers(phone, address, comuna)').eq('order_id', numberOnly);
                data = retry.data;
                error = retry.error;
            }

            // Si falla, probamos agregando OT-
            if ((!data || data.length === 0) && !orderId.toUpperCase().includes('OT-')) {
                const withPrefix = `OT-${orderId}`;
                const retry = await supabase.from('work_orders').select('*, customers(phone, address, comuna)').ilike('order_id', withPrefix);
                data = retry.data;
                error = retry.error;
            }

            if (error) {
                setDebugError(error.message);
            } else if (data && data.length > 0) {
                const item = data[0];
                setOrder({
                    ...item,
                    customer: item.customer_name,
                    device: item.device_name,
                    problem: item.reported_failure,
                    date: new Date(item.created_at).toLocaleDateString('es-CL'),
                    customer_address: item.customers?.address,
                    customer_commune: item.customers?.comuna, // Corrección: comuna en español
                    customer_phone: item.customers?.phone
                });
            }
            setLoading(false);
        };

        if (orderId) fetchOrder();
    }, [orderId]);

    // 🔥 LOGICA ORIGINAL DE PASOS (1-4)
    const getStatusStep = (status) => {
        const steps = {
            "En cola": 1,
            "Trabajando": 2,
            "Revisión del Coordinador": 3,
            "Notificado y no pagado": 3,
            "Pagado y no retirado": 3,
            "Retirado y no pagado": 3,
            "Finalizado y Pagado": 4,
            "Cancelado": 4
        };
        return steps[status] || 1;
    };

    // 🔥 LOGICA VISUAL (Colores e Iconos Bonitos)
    const getStatusVisuals = (status) => {
        const visuals = {
            "En cola": { color: "text-blue-400", bg: "bg-blue-500", icon: <Clock size={40} />, label: "En Espera" },
            "Trabajando": { color: "text-brand-purple", bg: "bg-brand-purple", icon: <Wrench size={40} className="animate-spin-slow" />, label: "En Reparación" },
            
            // Grupo Paso 3
            "Revisión del Coordinador": { color: "text-amber-400", bg: "bg-amber-500", icon: <Activity size={40} />, label: "Control de Calidad" },
            "Notificado y no pagado": { color: "text-emerald-400", bg: "bg-emerald-500", icon: <CheckCircle2 size={40} />, label: "Listo para Retiro" },
            "Pagado y no retirado": { color: "text-emerald-400", bg: "bg-emerald-500", icon: <Package size={40} />, label: "Pagado - Por Retirar" },
            "Retirado y no pagado": { color: "text-orange-400", bg: "bg-orange-500", icon: <AlertTriangle size={40} />, label: "Retirado (Pendiente Pago)" },
            
            // Grupo Paso 4
            "Finalizado y Pagado": { color: "text-emerald-400", bg: "bg-emerald-500", icon: <Star size={40} fill="currentColor" />, label: "Entregado" },
            "Cancelado": { color: "text-rose-400", bg: "bg-rose-500", icon: <AlertTriangle size={40} />, label: "Cancelado" }
        };
        return visuals[status] || visuals["En cola"];
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="w-12 h-12 border-4 border-slate-800 border-t-brand-purple rounded-full animate-spin"></div>
            <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Buscando Orden...</p>
        </div>
    );

    if (!order) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <div className="bg-rose-500/10 p-6 rounded-full mb-6 ring-1 ring-rose-500/30">
                <AlertTriangle size={48} className="text-rose-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Orden no encontrada</h1>
            <p className="max-w-xs mx-auto mb-6 text-sm leading-relaxed">No pudimos encontrar la orden <strong>{orderId}</strong>. Por favor verifica el enlace o contáctanos.</p>
            {debugError && <div className="bg-slate-900 text-slate-500 p-3 rounded-lg text-[10px] font-mono border border-white/5 max-w-sm overflow-hidden">{debugError}</div>}
        </div>
    );

    const currentStep = getStatusStep(order.status); 
    const visualInfo = getStatusVisuals(order.status); 

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-brand-purple selection:text-white pb-20 relative overflow-x-hidden">
            
            {/* Background Glows */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-purple/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 right-0 w-[300px] h-[300px] bg-brand-cyan/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-lg mx-auto relative z-10">
                
                {/* HEADER / HERO STATUS */}
                <div className="pt-12 pb-8 px-6 text-center">
                    <div className={`mx-auto w-24 h-24 rounded-3xl ${visualInfo.bg}/10 border border-${visualInfo.color.split('-')[1]}-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.3)] backdrop-blur-sm ring-1 ring-white/10`}>
                        <div className={visualInfo.color}>{visualInfo.icon}</div>
                    </div>
                    
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{visualInfo.label}</h1>
                    <div className="inline-flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        <span className={`w-2 h-2 rounded-full ${order.status === 'En cola' ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`}></span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Orden #{order.id}</span>
                    </div>
                </div>

                {/* TIMELINE */}
                <div className="px-6 mb-8">
                    <div className="relative">
                        <div className="absolute left-0 top-1/2 w-full h-1 bg-slate-800 rounded-full -z-10" />
                        <div 
                            className={`absolute left-0 top-1/2 h-1 bg-gradient-to-r from-brand-purple to-brand-cyan rounded-full -z-10 transition-all duration-1000 ease-out`} 
                            style={{ width: `${((currentStep - 1) / 3) * 100}%` }} 
                        />
                        
                        <div className="flex justify-between">
                            {[1, 2, 3, 4].map((step) => {
                                const isActive = step <= currentStep;
                                return (
                                    <div key={step} className="flex flex-col items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-slate-900 ${isActive ? 'border-brand-cyan text-white shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-110' : 'border-slate-800 text-slate-600'}`}>
                                            {isActive ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-bold">{step}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between px-1 mt-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            <span>Recepción</span>
                            <span>Taller</span>
                            <span>Listo</span>
                            <span>Entregado</span>
                        </div>
                    </div>
                </div>

                {/* CARD DETALLES */}
                <div className="px-4 mb-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-10 -mt-10 pointer-events-none" />

                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Dispositivo</p>
                                <h2 className="text-xl font-bold text-white leading-tight">{order.device}</h2>
                                <p className="text-xs text-brand-purple font-mono mt-1 flex items-center gap-1"><Hash size={10} /> {order.device_type}</p>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-2xl text-slate-300">
                                {order.device_type === 'Smartphone' ? <Smartphone size={24} /> : <Laptop size={24} />}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    <AlertTriangle size={12} className="text-orange-400" /> Diagnóstico Inicial
                                </div>
                                <p className="text-sm text-slate-200 italic">"{order.problem}"</p>
                            </div>

                            {order.observations && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nota Técnica</p>
                                    <p className="text-sm text-slate-400 leading-relaxed">{order.observations}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SECCIÓN DE ACCIONES */}
                <div className="px-4 space-y-3">
                    
                    {/* 🔥 BOTÓN DESCARGAR BOLETA/FACTURA (NUEVO) */}
                    {order.doc_url && (
                        <a 
                            href={order.doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full group bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-between px-6 transition-all border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.98]"
                        >
                            <span className="flex items-center gap-3"><Receipt size={18} /> Descargar {order.doc_type || "Documento"}</span>
                            <ChevronRight size={16} className="text-emerald-200 group-hover:translate-x-1 transition-transform" />
                        </a>
                    )}

                    {/* BOTÓN DESCARGAR INFORME */}
                    <button 
                        onClick={() => generateOrderPDF(order)}
                        className="w-full group bg-slate-800 hover:bg-slate-700 text-slate-200 py-4 rounded-2xl font-bold text-sm flex items-center justify-between px-6 transition-all border border-white/10 hover:border-white/20 active:scale-[0.98]"
                    >
                        <span className="flex items-center gap-3"><FileText size={18} className="text-brand-cyan" /> Informe Técnico PDF</span>
                        <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* BOTÓN GOOGLE REVIEW */}
                    <a 
                        href={GOOGLE_REVIEW_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full group bg-gradient-to-r from-amber-400 to-orange-500 text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-[0.98] transition-all relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl" />
                        <Star size={18} fill="black" className="relative z-10" /> 
                        <span className="relative z-10 tracking-wide">CALIFICAR SERVICIO</span>
                    </a>
                </div>

                {/* FOOTER */}
                <div className="mt-12 text-center border-t border-white/5 pt-6 pb-6">
                    <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">Servicio Técnico Especializado</p>
                </div>
            </div>
        </div>
    );
}