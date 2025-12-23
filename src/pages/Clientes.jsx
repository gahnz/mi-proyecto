import { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, User, 
    Building2, FileText, History, Wrench, ShoppingBag, 
    CreditCard, Calendar, X, Smartphone, Award, TrendingUp, Hash 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";
import { useCustomers } from "../hooks/useCustomers";

export default function Clientes() {
    const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
    
    // Estados básicos
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState(null);

    // Estados Historial (CRM)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedClientData, setSelectedClientData] = useState(null);
    const [historyTab, setHistoryTab] = useState("resumen");

    const [formData, setFormData] = useState({
        full_name: "",
        business_name: "", 
        rut: "",
        email: "",
        phone: "",
        address: "",
        type: "Particular" 
    });

    // --- LÓGICA CRUD ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        const promise = editingId ? updateCustomer(editingId, formData) : addCustomer(formData);
        toast.promise(promise, { loading: 'Guardando...', success: 'Guardado correctamente', error: 'Error al guardar' });
        try { await promise; setIsModalOpen(false); resetForm(); } catch (error) { console.error(error); }
    };

    const confirmDelete = (customer) => { setCustomerToDelete(customer); setIsDeleteModalOpen(true); };
    const handleDelete = async () => { if (!customerToDelete) return; await deleteCustomer(customerToDelete.id); setIsDeleteModalOpen(false); setCustomerToDelete(null); toast.success("Cliente eliminado"); };
    
    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setFormData({
            full_name: customer.full_name || "",
            business_name: customer.business_name || "",
            rut: customer.rut || "",
            email: customer.email || "",
            phone: customer.phone || "",
            address: customer.address || "",
            type: customer.type || "Particular"
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ full_name: "", business_name: "", rut: "", email: "", phone: "", address: "", type: "Particular" });
        setEditingId(null);
    };

    // --- LÓGICA DE HISTORIAL (CRM) ---
    const fetchClientHistory = async (client) => {
        setIsHistoryOpen(true);
        setHistoryLoading(true);
        setHistoryTab("resumen");

        try {
            // 1. Buscar Órdenes de Taller (Ordenadas por fecha/hora de creación)
            const { data: orders } = await supabase
                .from('work_orders')
                .select('*')
                .eq('customer_id', client.id)
                .order('created_at', { ascending: false }); // 👈 Lo más reciente arriba

            // 2. Buscar Ventas/Ingresos (Ordenadas por Fecha Y Hora)
            const searchName = client.type === 'Empresa' ? client.business_name : client.full_name;
            
            const { data: sales } = await supabase
                .from('cash_flow')
                .select('*')
                .eq('type', 'income')
                .or(`client_id.eq.${client.id},description.ilike.%${searchName}%`)
                .order('date', { ascending: false })       // 1° Prioridad: Fecha contable
                .order('created_at', { ascending: false }); // 2° Prioridad: Hora exacta (para desempatar mismo día)

            const totalWorkshop = orders?.reduce((acc, o) => acc + (Number(o.total_cost) || 0), 0) || 0;
            const totalSales = sales?.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0) || 0;
            
            const uniqueDevices = [...new Set(orders?.map(o => o.device_name).filter(Boolean))];

            setSelectedClientData({
                client,
                orders: orders || [],
                sales: sales || [],
                stats: {
                    totalSpent: totalSales, // Total real ingresado en caja
                    lastVisit: sales?.[0]?.date || orders?.[0]?.start_date?.split('T')[0] || "N/A",
                    totalVisits: (orders?.length || 0) + (sales?.filter(s => !s.description.includes('Servicio Técnico')).length || 0),
                    devices: uniqueDevices
                }
            });

        } catch (error) {
            console.error("Error fetching history:", error);
            toast.error("Error al cargar historial");
        } finally {
            setHistoryLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c => 
        (c.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.business_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.rut || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Cartera de Clientes</h1>
                    <p className="text-slate-400 text-sm font-medium">Gestión y fidelización.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" placeholder="Buscar por nombre, RUT..." className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-brand-purple transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-purple/20"><Plus size={18} /> Nuevo Cliente</button>
                </div>
            </div>

            {/* Lista de Clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map(customer => (
                    <div key={customer.id} className="bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-brand-cyan/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button onClick={() => handleEdit(customer)} className="p-2 bg-slate-800 rounded-lg hover:text-brand-cyan text-slate-400"><Edit3 size={14}/></button>
                            <button onClick={() => confirmDelete(customer)} className="p-2 bg-slate-800 rounded-lg hover:text-rose-500 text-slate-400"><Trash2 size={14}/></button>
                        </div>
                        
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${customer.type === 'Empresa' ? 'bg-blue-500/10 text-blue-400' : 'bg-brand-purple/10 text-brand-purple'}`}>
                                {customer.type === 'Empresa' ? <Building2 size={24} /> : <User size={24} />}
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg leading-tight line-clamp-1">{customer.type === 'Empresa' ? customer.business_name : customer.full_name}</h3>
                                <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-white/5 mt-1 inline-block">{customer.rut || 'Sin RUT'}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400 mb-4">
                            {customer.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-600"/> {customer.phone}</div>}
                            {customer.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-600"/> <span className="truncate">{customer.email}</span></div>}
                            {customer.address && <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-600"/> <span className="truncate">{customer.address}</span></div>}
                        </div>

                        <button onClick={() => fetchClientHistory(customer)} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-brand-purple/50">
                            <History size={16} /> Ver Historial
                        </button>
                    </div>
                ))}
            </div>

            {/* MODAL CREAR/EDITAR */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white italic uppercase">{editingId ? "Editar Cliente" : "Nuevo Cliente"}</h2><button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button></div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-white/5">{['Particular', 'Empresa'].map(t => (<button key={t} type="button" onClick={() => setFormData({...formData, type: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${formData.type === t ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>{t}</button>))}</div>
                            {formData.type === 'Empresa' ? (
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Razón Social</label><input required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.business_name} onChange={(e) => setFormData({...formData, business_name: e.target.value})} /></div>
                            ) : (
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nombre Completo</label><input required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} /></div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">RUT</label><input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.rut} onChange={(e) => setFormData({...formData, rut: e.target.value})} /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Teléfono</label><input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
                            </div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email</label><input type="email" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dirección</label><input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
                            <button className="w-full bg-brand-gradient py-3 rounded-xl text-white font-black uppercase tracking-widest hover:opacity-90">Guardar Cliente</button>
                        </form>
                    </div>
                </div>
            )}

            {/* 🔥 MODAL DE HISTORIAL CRM */}
            {isHistoryOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        
                        {/* Header CRM */}
                        <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                                    {selectedClientData?.client.type === 'Empresa' ? selectedClientData?.client.business_name : selectedClientData?.client.full_name}
                                    {selectedClientData?.stats.totalSpent > 1000000 && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-1 rounded-full border border-amber-500/30 flex items-center gap-1"><Award size={12}/> VIP</span>}
                                </h2>
                                <p className="text-slate-400 text-sm flex items-center gap-4 mt-1">
                                    <span className="flex items-center gap-1"><Phone size={12}/> {selectedClientData?.client.phone || "Sin teléfono"}</span>
                                    <span className="flex items-center gap-1"><Mail size={12}/> {selectedClientData?.client.email || "Sin email"}</span>
                                </p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                            {/* Tabs */}
                            <div className="flex border-b border-white/5 bg-slate-950/50">
                                {[
                                    { id: 'resumen', label: 'Resumen Global', icon: <TrendingUp size={16} /> },
                                    { id: 'taller', label: `Historial Taller (${selectedClientData?.orders.length || 0})`, icon: <Wrench size={16} /> },
                                    { id: 'ventas', label: `Historial Compras (${selectedClientData?.sales.length || 0})`, icon: <ShoppingBag size={16} /> }
                                ].map(tab => (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => setHistoryTab(tab.id)}
                                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${historyTab === tab.id ? 'border-brand-purple text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Contenido */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {historyLoading ? (
                                    <div className="text-center py-20 text-slate-500 animate-pulse">Cargando datos del cliente...</div>
                                ) : (
                                    <>
                                        {/* VISTA RESUMEN */}
                                        {historyTab === 'resumen' && selectedClientData && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-white/5">
                                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Inversión Total</p>
                                                        <h3 className="text-2xl font-black text-emerald-400 tracking-tighter">${selectedClientData.stats.totalSpent.toLocaleString('es-CL')}</h3>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-white/5">
                                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Visitas Totales</p>
                                                        <h3 className="text-2xl font-black text-white tracking-tighter">{selectedClientData.stats.totalVisits}</h3>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-white/5">
                                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Última Actividad</p>
                                                        <h3 className="text-xl font-bold text-slate-300 tracking-tighter">
                                                            {selectedClientData.stats.lastVisit !== "N/A" ? new Date(selectedClientData.stats.lastVisit).toLocaleDateString() : "Nunca"}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2"><Smartphone size={16} className="text-brand-purple"/> Equipos Registrados</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedClientData.stats.devices.length > 0 ? selectedClientData.stats.devices.map((device, idx) => (
                                                            <span key={idx} className="bg-slate-950 border border-white/10 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold">{device}</span>
                                                        )) : <span className="text-slate-500 text-xs italic">No hay equipos registrados.</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* VISTA TALLER (Ordenado por created_at + Link ID MOV) */}
                                        {historyTab === 'taller' && (
                                            <div className="space-y-3">
                                                {selectedClientData?.orders.length === 0 && <div className="text-center text-slate-500 text-xs py-10">Sin órdenes de trabajo.</div>}
                                                {selectedClientData?.orders.map(order => {
                                                    // Buscamos si hay un pago asociado en la lista de ventas (cruce por ID de Orden en descripción)
                                                    const relatedSale = selectedClientData.sales.find(s => s.description && s.description.includes(order.id));
                                                    const formattedMovId = relatedSale ? `MOV-${String(relatedSale.id).padStart(5, '0')}` : null;

                                                    return (
                                                        <div key={order.id} className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex justify-between items-center hover:bg-slate-800/50 transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-brand-purple/10 text-brand-purple p-3 rounded-lg"><Wrench size={18}/></div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-white font-bold text-sm">{order.device_name}</span>
                                                                        <span className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-white/10 uppercase font-bold">{order.id}</span>
                                                                        {/* MOSTRAR ID MOV SI EXISTE */}
                                                                        {formattedMovId && (
                                                                            <span className="text-[9px] bg-brand-cyan/10 text-brand-cyan px-1.5 py-0.5 rounded border border-brand-cyan/20 font-mono font-bold flex items-center gap-1">
                                                                                <Hash size={8} />{formattedMovId}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 mt-0.5">{order.job_type} - {new Date(order.created_at).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-[10px] font-black uppercase tracking-wider block mb-1 ${order.status.includes('Finalizado') ? 'text-emerald-500' : 'text-amber-500'}`}>{order.status}</span>
                                                                <span className="text-white font-bold text-sm">${order.total_cost.toLocaleString('es-CL')}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* VISTA VENTAS (Ordenada por Fecha + Hora) */}
                                        {historyTab === 'ventas' && (
                                            <div className="space-y-3">
                                                {selectedClientData?.sales.length === 0 && <div className="text-center text-slate-500 text-xs py-10">Sin compras registradas.</div>}
                                                {selectedClientData?.sales.map(sale => {
                                                    const formattedId = `MOV-${String(sale.id).padStart(5, '0')}`;
                                                    return (
                                                        <div key={sale.id} className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex justify-between items-center hover:bg-slate-800/50 transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-brand-cyan/10 text-brand-cyan p-3 rounded-lg"><ShoppingBag size={18}/></div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[9px] bg-brand-cyan/10 text-brand-cyan px-1.5 py-0.5 rounded border border-brand-cyan/20 font-mono font-bold">
                                                                            <Hash size={8} className="inline mr-0.5"/>{formattedId}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                            <Calendar size={10}/> {sale.date}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="text-white font-bold text-sm truncate max-w-[200px]">{sale.description.replace('Venta POS | ', '').replace('Servicio Técnico ', '')}</div>
                                                                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                                        <CreditCard size={10}/> {sale.payment_method}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className="text-emerald-400 font-bold text-lg tracking-tight">+${sale.total_amount.toLocaleString('es-CL')}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ELIMINAR */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4"><div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300"><h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar Cliente?</h2><p className="text-slate-400 mb-8 text-xs font-medium px-4">Esta acción es irreversible.</p><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest">Cancelar</button><button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic">Sí, Eliminar</button></div></div></div>
            )}
        </div>
    );
}