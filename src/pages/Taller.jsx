import { useState, useEffect } from "react";
import {
    Plus, Search, Smartphone, Laptop, Tablet, User, Calendar, DollarSign,
    MapPin, Clock, FileText, PenTool, Trash2, Monitor, Printer, Cpu, Share2, Home, Car
} from "lucide-react";
import { supabase } from "../supabase/client";
import { toast } from "sonner"; 

import { useWorkOrders } from "../hooks/useWorkOrders";
import { useCustomers } from "../hooks/useCustomers";
import { useEquipos } from "../hooks/useEquipos";
import { useInventory } from "../hooks/useInventory";
import { generateOrderPDF } from "../utils/pdfGenerator"; 
// IMPORTAMOS EL NUEVO COMPONENTE MODAL
import OrderModal from "../components/taller/OrderModal";

const Taller = () => {
    const { orders: repairs, loading, deleteOrder, refresh } = useWorkOrders();
    const { customers: clients } = useCustomers();
    const { equipments: equipmentsList } = useEquipos();
    const { inventory: inventoryItems } = useInventory();

    const [technicians, setTechnicians] = useState([]);
    const [filterStatus, setFilterStatus] = useState("Todos");
    const [filterTech, setFilterTech] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");

    // Estado simplificado: solo controla si el modal abre y qué orden se edita
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    useEffect(() => {
        const fetchTechnicians = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("full_name")
                .in("role", ["tecnico", "coordinador", "admin"]);
            if (data) setTechnicians(data.map(t => t.full_name).filter(Boolean));
        };
        fetchTechnicians();
    }, []);

    const smartSearch = (text, search) => {
        if (!text || !search) return false;
        const searchTerms = search.toLowerCase().split(" ").filter(Boolean);
        const textLower = text.toLowerCase();
        return searchTerms.every(term => textLower.includes(term));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "En cola": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
            case "Trabajando": return "bg-brand-purple/10 text-brand-purple border-brand-purple/20";
            case "Finalizado y Pagado": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "Cancelado": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
            default: return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        }
    };

    const getDeviceIcon = (type) => {
        switch ((type || "").toLowerCase()) {
            case "smartphone": case "celular": return <Smartphone size={18} />;
            case "notebook": case "laptop": return <Laptop size={18} />;
            case "tablet": return <Tablet size={18} />;
            case "impresora": return <Printer size={18} />;
            case "pc": return <Monitor size={18} />;
            default: return <Cpu size={18} />;
        }
    };

    const filteredRepairs = repairs.filter(repair => {
        let matchesStatus = true;
        if (filterStatus !== "Todos") {
            if (filterStatus === "En Cola") matchesStatus = repair.status === "En cola" || repair.status === "Trabajando";
            else if (filterStatus === "Revisión") matchesStatus = ["Revisión del Coordinador", "Notificado y no pagado", "Pagado y no retirado"].includes(repair.status);
            else matchesStatus = repair.status === filterStatus;
        }
        
        const matchesTech = filterTech === "Todos" || (repair.technician || "").includes(filterTech);
        const searchableString = `${repair.customer || ""} ${repair.id || ""} ${repair.device || ""} ${repair.status || ""}`;
        const matchesSearch = searchTerm === "" || smartSearch(searchableString, searchTerm);

        return matchesStatus && matchesSearch && matchesTech;
    });

    const handleOpenCreate = () => {
        setEditingOrder(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (order) => {
        setEditingOrder(order);
        setIsModalOpen(true);
    };

    const handleDeleteOrder = async (order) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de eliminar la orden ${order.id}?`)) return;
        const processDelete = async () => {
            // Lógica de restauración de stock podría ir aquí o en el hook
            if (order.stock_deducted && order.items?.length > 0) {
               // ... llamada a restore stock ...
            }
            await deleteOrder(order.db_id);
            await refresh();
        };
        toast.promise(processDelete(), {
            loading: 'Eliminando...',
            success: 'Orden eliminada',
            error: (err) => `Error: ${err.message}`
        });
    };

    const handleShareLink = (e, orderId) => {
        e.stopPropagation();
        const link = `${window.location.origin}/tracker/${orderId}`;
        navigator.clipboard.writeText(link).then(() => toast.success("Enlace copiado"));
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">Taller & Servicios</h1>
                    <p className="text-slate-400 font-medium">Gestión integral de órdenes de trabajo.</p>
                </div>
                <button onClick={handleOpenCreate} className="bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"><Plus size={20} /> Nueva Orden</button>
            </div>

            {/* Filters */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 flex-wrap">
                        {["Todos", "En Cola", "Revisión", "Finalizados"].map((status) => (
                            <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterStatus === status ? "bg-white/10 text-white shadow-inner border border-white/5" : "text-slate-500 hover:text-white hover:bg-white/5"}`}>{status}</button>
                        ))}
                    </div>
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>
                    <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="bg-slate-800/50 border border-white/10 rounded-lg py-2 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-brand-purple/50 uppercase tracking-wider">
                        <option value="Todos">👨‍🔧 Todos los Técnicos</option>
                        {technicians.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" placeholder="Buscar Cliente, OT, Equipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all" />
                    </div>
                </div>
            </div>

            {/* Repairs Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredRepairs.map((repair) => (
                    <div key={repair.id} onClick={() => handleOpenEdit(repair)} className="group bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5 p-5 hover:border-brand-purple/30 transition-all hover:shadow-lg relative overflow-hidden cursor-pointer">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${repair.status === 'En cola' ? 'bg-blue-500' : 'bg-brand-purple'}`} />
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center pl-3">
                            <div className="flex items-center gap-4 min-w-[220px]">
                                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-brand-cyan transition-all">{getDeviceIcon(repair.type)}</div>
                                <div><span className="text-[10px] font-black uppercase tracking-widest text-brand-purple block mb-0.5">{repair.id}</span><h3 className="font-bold text-lg text-white leading-tight">{repair.device}</h3><span className="text-[10px] text-slate-500 uppercase font-bold bg-slate-800 px-2 py-0.5 rounded mt-1 inline-block">{repair.job_type}</span></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(repair.status)}`}>{repair.status}</span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1"><User size={10} /> {repair.customer}</span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-purple/10 text-brand-purple border border-brand-purple/20 flex items-center gap-1"><PenTool size={10} /> {repair.technician || "Sin Asignar"}</span>
                                    
                                    {/* Indicador Modalidad */}
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${repair.location === 'Terreno' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                        {repair.location === 'Terreno' ? <Car size={10} /> : <Home size={10} />}
                                        {repair.location || 'Local'}
                                    </span>
                                </div>

                                {/* FECHAS DESTACADAS (Usando UTC) */}
                                <div className="flex flex-wrap gap-3 mt-1">
                                    {repair.start_date && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-brand-cyan bg-brand-cyan/5 px-2 py-0.5 rounded border border-brand-cyan/10 font-bold uppercase">
                                            <Calendar size={10} />
                                            INI: {new Date(repair.start_date).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                        </div>
                                    )}
                                    {repair.estimated_end_date && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 font-bold uppercase">
                                            <Clock size={10} />
                                            FIN: {new Date(repair.estimated_end_date).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                        </div>
                                    )}
                                </div>

                                <p className="text-slate-400 text-sm line-clamp-1 italic mt-1">"{repair.problem}"</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-slate-500 min-w-[200px] justify-end">
                                <div className="text-right">
                                    <div className={`flex items-center justify-end gap-1 font-bold ${repair.total_cost > 0 ? 'text-brand-cyan' : 'text-slate-600'}`}><DollarSign size={14} /><span>{repair.total_cost > 0 ? Number(repair.total_cost).toLocaleString('es-CL') : 'Pendiente'}</span></div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); generateOrderPDF(repair); }} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all" title="Descargar Orden PDF"><FileText size={18} /></button>
                                    <button onClick={(e) => handleShareLink(e, repair.id)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all" title="Copiar Link de Seguimiento"><Share2 size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(repair); }} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all" title="Eliminar Orden"><Trash2 size={20} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {filteredRepairs.length === 0 && !loading && <div className="text-center py-20 text-slate-300 text-sm font-medium">No hay órdenes registradas.</div>}

            {/* 🔥 AQUÍ USAMOS EL NUEVO COMPONENTE MODAL 🔥 */}
            <OrderModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                editingOrder={editingOrder}
                technicians={technicians}
                clients={clients}
                equipmentsList={equipmentsList}
                inventoryItems={inventoryItems}
                onOrderSaved={refresh} // Al guardar, refrescamos la lista
            />
        </div>
    );
};

export default Taller;