import { useState, useEffect, useRef } from "react";
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from "react-router-dom";
import {
    Wrench, ClipboardCheck, Clock, User, CheckCircle2,
    AlertCircle, ChevronRight, PenTool, Save, X, Search, Cpu, RefreshCw,
    MessageSquare, ExternalLink, MapPin, Camera, Image, ArrowLeft, Send
} from "lucide-react";
import { INITIAL_REPAIRS } from "../data/mockData";
import { storage } from "../services/storage";
import { supabase } from "../supabase/client";

const SHAKE_ANIMATION = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
`;

export default function PortalTecnico() {
    const navigate = useNavigate();
    const [selectedTech, setSelectedTech] = useState("");
    const [userRole, setUserRole] = useState("");
    const [allTechnicians, setAllTechnicians] = useState([]);
    const [clients, setClients] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [shakeFields, setShakeFields] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const sigPad = useRef(null);
    const [reportForm, setReportForm] = useState({
        probReal: "",
        solReal: "",
        obs: "",
        status: "",
        photoBefore: null,
        photoAfter: null,
        receiverName: "",
        receiverSignature: null
    });

    useEffect(() => {
        checkAuthAndSetTech();
    }, []);

    useEffect(() => {
        if (selectedTech) {
            loadTechOrders();
        }
    }, [selectedTech]);

    async function checkAuthAndSetTech() {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        // Cargar lista de técnicos para el selector de respaldo
        const { data: techList } = await supabase
            .from("profiles")
            .select("full_name")
            .in("role", ["tecnico", "coordinador", "admin"]);

        if (techList) setAllTechnicians(techList.map(t => t.full_name));

        if (session) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, role")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                if (profile.full_name) {
                    setSelectedTech(profile.full_name);
                }
                if (profile.role) {
                    setUserRole(profile.role);
                }
            }
        }
        setLoading(false);
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login-tecnico");
    };

    async function loadTechOrders() {
        setLoading(true);
        console.log("Loading orders for:", selectedTech);

        const currentTech = (selectedTech || "").trim();

        // 1. Fetch filtered Work Orders and all Customers from Supabase
        let query = supabase.from("work_orders").select("*");

        // If not admin/coordinador, filter by technician name in the query
        if (userRole !== 'admin' && userRole !== 'coordinador') {
            query = query.eq("technician_name", currentTech);
        }

        const [{ data: ordersData, error: ordersError }, { data: clientsData }] = await Promise.all([
            query.order('created_at', { ascending: false }),
            supabase.from("customers").select("*")
        ]);

        if (ordersError) {
            console.error("Error fetching orders:", ordersError);
            setLoading(false);
            return;
        }

        if (clientsData) setClients(clientsData);

        // 2. Map and filter for pending status
        const techOrders = (ordersData || []).map(o => ({
            ...o,
            id: o.display_id || o.id,
            db_id: o.id,
            device: o.device_name,
            problem: o.reported_fault,
            customer: o.customer_name,
            technician: o.technician_name
        })).filter(o =>
            !["Finalizado y Pagado", "Cancelado", "Finalizado", "Revisión del Coordinador"].includes(o.status)
        );

        setOrders(techOrders);
        setLoading(false);
    }

    const handleOpenReport = (order) => {
        setEditingOrder(order);
        setReportForm({
            probReal: order.prob_real || "",
            solReal: order.sol_real || "",
            obs: order.observations || "",
            status: order.status || "Trabajando",
            photoBefore: order.photo_before || null,
            photoAfter: order.photo_after || null,
            receiverName: order.receiver_name || "",
            receiverSignature: order.receiver_signature || null
        });
    };

    const handleArrive = async () => {
        if (!editingOrder) return;

        const { error } = await supabase
            .from("work_orders")
            .update({ status: "Trabajando" })
            .eq("id", editingOrder.db_id);

        if (error) {
            alert("Error al marcar llegada: " + error.message);
            return;
        }

        setReportForm(prev => ({ ...prev, status: "Trabajando" }));
        loadTechOrders();
    };

    const handleSaveReport = async (forceStatus = null) => {
        console.log("handleSaveReport CLICKED", forceStatus);

        // If it's a "Send Report", we MUST have the required fields
        if (forceStatus && (!reportForm.probReal || !reportForm.solReal)) {
            setShakeFields(true);
            setTimeout(() => setShakeFields(false), 500);
            alert("⚠️ NO SE PUEDE ENVIAR: Por favor completa el 'Diagnóstico' y el 'Trabajo Realizado' antes de enviar a revisión.");
            return;
        }

        setSaving(true);
        try {
            const finalStatus = forceStatus || reportForm.status;
            console.log("Saving report for order:", editingOrder.db_id, "with status:", finalStatus);

            const { error } = await supabase
                .from("work_orders")
                .update({
                    prob_real: reportForm.probReal,
                    sol_real: reportForm.solReal,
                    observations: reportForm.obs,
                    status: finalStatus,
                    photo_before: reportForm.photoBefore,
                    photo_after: reportForm.photoAfter,
                    receiver_name: reportForm.receiverName,
                    receiver_signature: reportForm.receiverSignature
                })
                .eq("id", editingOrder.db_id);

            if (error) throw error;

            if (forceStatus) {
                alert("🚀 Informe enviado a revisión exitosamente.");
            } else {
                alert("💾 Cambios guardados temporalmente.");
            }

            setEditingOrder(null);
            loadTechOrders();
        } catch (error) {
            console.error("Error saving report:", error);
            alert("❌ Error: " + (error.message || "Error desconocido"));
        } finally {
            setSaving(false);
        }
    };

    // Debugging attachment
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.debugSaveReport = handleSaveReport;
        }
    }, [handleSaveReport]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando Perfil...</p>
            </div>
        );
    }

    if (!selectedTech) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col">
                <div className="p-8 flex justify-center items-center">
                    <div className="flex items-center gap-3">
                        <Cpu className="text-brand-purple" size={32} />
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">Portal Técnico</h1>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] shadow-2xl text-center max-w-md w-full animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-brand-gradient rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-purple/20">
                            <Wrench className="text-white" size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Sin Perfil Asignado</h2>
                        <p className="text-slate-500 text-sm font-medium mb-8 text-balance">Tu cuenta no tiene un nombre de técnico vinculado. Por favor, selecciona uno o contacta al admin.</p>

                        <div className="grid grid-cols-2 gap-3">
                            {allTechnicians.map(tech => (
                                <button
                                    key={tech}
                                    onClick={() => setSelectedTech(tech)}
                                    className="p-4 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold hover:border-brand-purple hover:bg-brand-purple/10 transition-all uppercase tracking-widest text-[10px]"
                                >
                                    {tech}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-dark p-6 md:p-10 space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-purple/20 rounded-2xl flex items-center justify-center text-brand-purple border border-brand-purple/30">
                        <PenTool size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] text-brand-purple font-black uppercase tracking-[0.2em]">Sesión Iniciada</p>
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{selectedTech}</h2>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadTechOrders}
                        disabled={loading}
                        className="p-3 bg-slate-800 text-slate-400 hover:text-brand-cyan rounded-xl transition-all border border-white/5 disabled:opacity-50"
                        title="Actualizar Órdenes"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="px-6 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* PENDING TASKS LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.length === 0 ? (
                    <div className="col-span-full py-20 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/10 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-600">
                            <ClipboardCheck size={40} />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">No hay trabajos aquí</h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-6 max-w-xs mx-auto">
                            No encontramos servicios pendientes para: <span className="text-brand-purple">"{selectedTech}"</span>
                        </p>
                        <div className="space-y-3">
                            <p className="text-slate-600 text-[10px] uppercase font-medium">Sugerencias:</p>
                            <ul className="text-[10px] text-slate-500 space-y-1">
                                <li>• Revisa que el técnico en la OT sea exactamente "{selectedTech}"</li>
                                <li>• Asegúrate que el estado de la OT no sea "Finalizado"</li>
                                <li>• Usa el botón de refrescar arriba a la derecha</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="bg-slate-900 border border-white/5 rounded-3xl p-6 hover:border-brand-cyan/30 transition-all group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === 'Trabajando' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                                        order.status === 'En cola' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                        {order.status}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-600">ID: {order.id}</span>
                                </div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">{order.device || order.equipmentName || "Equipo Celular"}</h3>
                                <p className="text-xs text-slate-400 mb-4 flex items-center gap-2">
                                    <AlertCircle size={12} className="text-rose-500" />
                                    Falla: {order.problem || order.reportedFault}
                                </p>

                                {order.probReal && (
                                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-4">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase mb-1">Diagnóstico Actual</p>
                                        <p className="text-[11px] text-slate-300 italic">"{order.solReal}"</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleOpenReport(order)}
                                className="w-full mt-4 bg-slate-800 hover:bg-brand-cyan hover:text-white text-slate-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <PenTool size={14} />
                                Actualizar Informe
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* MODAL: TECHNICAL REPORT */}
            {editingOrder && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-950/40">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-brand-gradient rounded-2xl flex items-center justify-center text-white">
                                    <PenTool size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Informe Técnico</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Orden #{editingOrder.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingOrder(null)} className="p-2 bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-all"><X size={24} /></button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* CLIENT CONTACT INFO SECTION */}
                            {(() => {
                                const client = clients.find(c => String(c.id) === String(editingOrder.customer_id));
                                if (!client) return (
                                    <div className="p-4 bg-slate-950/30 rounded-2xl text-xs text-slate-500 italic text-center border border-dashed border-white/5">
                                        Información de cliente no disponible (ID: {editingOrder.customer_id})
                                    </div>
                                );
                                return (
                                    <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-6 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-black text-brand-purple uppercase tracking-widest mb-1">Información del Cliente</p>
                                                <h4 className="text-lg font-black text-white italic uppercase tracking-tight">
                                                    {client.type === 'Empresa' ? client.business_name : client.full_name}
                                                </h4>
                                            </div>
                                            {client.phone && (
                                                <a
                                                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    <MessageSquare size={16} /> WhatsApp
                                                </a>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ubicación del Servicio</p>
                                                <p className="text-xs text-slate-300 font-medium line-clamp-1">{client.address || 'Sin dirección registrada'}</p>
                                            </div>
                                            {client.address && (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${client.address}, ${client.comuna || ''}, ${client.region || ''}`)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-3 bg-brand-cyan/10 text-brand-cyan rounded-2xl border border-brand-cyan/20 hover:bg-brand-cyan hover:text-white transition-all"
                                                    title="Ver en Google Maps"
                                                >
                                                    <MapPin size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ARRIVAL BUTTON */}
                            {reportForm.status === "En cola" && (
                                <button
                                    onClick={handleArrive}
                                    className="w-full py-4 bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 animate-pulse"
                                >
                                    <MapPin size={24} />
                                    ¡Llegué! (Empezar Trabajo)
                                </button>
                            )}

                            {reportForm.status !== "En cola" && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Estado de Reparación</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["En cola", "Trabajando", "Esperando Repuesto", "Listo para Retiro"].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setReportForm({ ...reportForm, status: s })}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${reportForm.status === s ? 'bg-brand-purple border-brand-purple text-white' : 'bg-slate-950 border-white/5 text-slate-600 hover:text-white'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ml-1 ${!reportForm.probReal && shakeFields ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>
                                        Diagnóstico (Problema Real) * {!reportForm.probReal && shakeFields && "(OBLIGATORIO)"}
                                    </label>
                                    <textarea
                                        className={`w-full bg-slate-950 border rounded-2xl p-4 text-white text-sm outline-none transition-all min-h-[100px] ${!reportForm.probReal && shakeFields ? 'border-rose-500 bg-rose-500/5 animate-[shake_0.5s_ease-in-out]' : 'border-white/5 focus:border-emerald-500/50'}`}
                                        placeholder="Escribe el diagnóstico exacto detectado..."
                                        value={reportForm.probReal}
                                        onChange={(e) => setReportForm({ ...reportForm, probReal: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ml-1 ${!reportForm.solReal && shakeFields ? 'text-rose-500 animate-pulse' : 'text-brand-cyan'}`}>
                                        Trabajo Realizado (Solución) * {!reportForm.solReal && shakeFields && "(OBLIGATORIO)"}
                                    </label>
                                    <textarea
                                        className={`w-full bg-slate-950 border rounded-2xl p-4 text-white text-sm outline-none transition-all min-h-[100px] ${!reportForm.solReal && shakeFields ? 'border-rose-500 bg-rose-500/5 animate-[shake_0.5s_ease-in-out]' : 'border-white/5 focus:border-brand-cyan/50'}`}
                                        placeholder="Describe qué reparaste o cambiaste..."
                                        value={reportForm.solReal}
                                        onChange={(e) => setReportForm({ ...reportForm, solReal: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Observaciones Internas (Opcional)</label>
                                    <textarea
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-slate-400 text-sm outline-none focus:border-white/20 transition-all min-h-[80px]"
                                        placeholder="Detalles solo para el equipo..."
                                        value={reportForm.obs}
                                        onChange={(e) => setReportForm({ ...reportForm, obs: e.target.value })}
                                    />
                                </div>

                                {/* PHOTOS SECTION */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Antes</label>
                                        <div className="relative aspect-square rounded-2xl border-2 border-dashed border-white/10 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
                                            {reportForm.photoBefore ? (
                                                <>
                                                    <img src={reportForm.photoBefore} className="w-full h-full object-cover" />
                                                    <button onClick={() => setReportForm({ ...reportForm, photoBefore: null })} className="absolute top-2 right-2 p-1 bg-red-500 rounded-lg text-white"><X size={14} /></button>
                                                </>
                                            ) : (
                                                <div className="text-center p-2 relative">
                                                    <Camera size={24} className="mx-auto mb-1 text-slate-700" />
                                                    <p className="text-[8px] text-slate-600 font-bold uppercase">Foto Antes</p>
                                                    <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setReportForm({ ...reportForm, photoBefore: reader.result });
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Después</label>
                                        <div className="relative aspect-square rounded-2xl border-2 border-dashed border-white/10 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
                                            {reportForm.photoAfter ? (
                                                <>
                                                    <img src={reportForm.photoAfter} className="w-full h-full object-cover" />
                                                    <button onClick={() => setReportForm({ ...reportForm, photoAfter: null })} className="absolute top-2 right-2 p-1 bg-red-500 rounded-lg text-white"><X size={14} /></button>
                                                </>
                                            ) : (
                                                <div className="text-center p-2 relative">
                                                    <Camera size={24} className="mx-auto mb-1 text-slate-700" />
                                                    <p className="text-[8px] text-slate-600 font-bold uppercase">Foto Después</p>
                                                    <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setReportForm({ ...reportForm, photoAfter: reader.result });
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* RECEPTION SECTION */}
                                <div className="p-6 bg-slate-950 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User size={16} className="text-brand-purple" />
                                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Recepción de Cliente</h4>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Nombre quien recibe..."
                                        className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-brand-purple"
                                        value={reportForm.receiverName}
                                        onChange={(e) => setReportForm({ ...reportForm, receiverName: e.target.value })}
                                    />
                                    <div className="relative rounded-xl border border-dashed border-white/10 bg-slate-900 overflow-hidden">
                                        {reportForm.receiverSignature ? (
                                            <div className="relative h-32 flex items-center justify-center">
                                                <img src={reportForm.receiverSignature} className="h-full object-contain" alt="Firma" />
                                                <button onClick={() => setReportForm({ ...reportForm, receiverSignature: null })} className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white shadow-lg"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <div className="bg-white rounded-t-xl">
                                                    <SignatureCanvas
                                                        ref={sigPad}
                                                        penColor='black'
                                                        canvasProps={{
                                                            className: 'w-full h-32 cursor-crosshair'
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex border-t border-white/5 bg-slate-900">
                                                    <button
                                                        type="button"
                                                        onClick={() => sigPad.current.clear()}
                                                        className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white border-r border-white/5 transition-all"
                                                    >
                                                        Borrar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (sigPad.current.isEmpty()) return;
                                                            setReportForm({ ...reportForm, receiverSignature: sigPad.current.toDataURL('image/png') });
                                                        }}
                                                        className="flex-1 py-3 text-[10px] font-black uppercase text-brand-cyan hover:bg-brand-cyan/10 transition-all"
                                                    >
                                                        Confirmar Firma
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-950/60 border-t border-white/5 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleSaveReport()}
                                disabled={saving}
                                className="py-4 bg-slate-700/50 text-slate-300 font-black uppercase tracking-widest rounded-2xl border border-white/5 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save size={16} /> {saving ? "..." : "Guardar"}
                            </button>
                            <button
                                onClick={() => handleSaveReport("Revisión del Coordinador")}
                                disabled={saving}
                                className="py-4 bg-brand-gradient text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-purple/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 italic"
                            >
                                <Send size={16} /> {saving ? "..." : "Enviar Informe"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{SHAKE_ANIMATION}</style>
        </div>
    );
}
