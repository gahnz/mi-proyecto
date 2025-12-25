import { useState, useEffect } from "react";
import {
    DollarSign, Plus, Search, ArrowUpCircle, ArrowDownCircle,
    FileText, Calendar, TrendingUp, Download, Trash2,
    Info, Calculator, Landmark, Pencil, CreditCard, Banknote, Percent,
    ShoppingBag, X, AlertTriangle, PackageMinus, Store,
    Lock, Unlock, CheckCircle, Clock, Truck, 
    Eye, UploadCloud, FileCheck, Hash, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";
import { useCashFlow } from "../hooks/useCashFlow";
import { useInventory } from "../hooks/useInventory";
import { PAYMENT_METHODS, TAX_CATEGORIES, DOCUMENT_TYPES, WAREHOUSES } from "../constants";
import { getChileTime } from "../utils/time";

const DELIVERY_COST = 3570;

const FlujoCaja = () => {
    // 1. Configuración de Paginación y Mes
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

    // 2. Hook actualizado
    const { movements, stats, totalCount, loading, addMovement, updateMovement, deleteMovement, uploadDocument } = useCashFlow(page, PAGE_SIZE, filterMonth);
    const { inventory, updateItem } = useInventory();

    const [technicians, setTechnicians] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEcommerceModalOpen, setIsEcommerceModalOpen] = useState(false);
    const [filterType, setFilterType] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [uploadingId, setUploadingId] = useState(null);
    
    // UI Helpers
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [showItemResults, setShowItemResults] = useState(false);
    const [selectedItemName, setSelectedItemName] = useState(""); 
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [viewingItems, setViewingItems] = useState(null); 
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: "income",
        docType: "39",
        docNumber: "",
        description: "",
        category: "VENTA",
        netAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        isTaxable: true,
        paymentMethod: "Mercado Pago",
        receivedAmount: 0,
        commissionAmount: 0,
        isEcommerce: false,
        itemId: "",
        warehouse: "Mercado Libre",
        quantity: 1,
        status: "confirmed",
        deliveryBy: "",
        docUrl: ""
    });

    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

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

    const handleFileUpload = async (e, movementId) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingId(movementId);
        toast.promise(uploadDocument(movementId, file), {
            loading: 'Subiendo...',
            success: () => { setUploadingId(null); return 'Listo 📎'; },
            error: (err) => { setUploadingId(null); return `Error: ${err.message}`; }
        });
    };

    const handleStockRestoration = async (itemsToRestore) => {
        if (!itemsToRestore || !Array.isArray(itemsToRestore) || itemsToRestore.length === 0) return;
        const promises = itemsToRestore.map(item => {
            if (item.type === 'Servicio') return Promise.resolve();
            return supabase.rpc('restore_inventory_stock', {
                item_id: parseInt(item.id, 10), quantity: parseInt(item.quantity || 1, 10), warehouse_name: "Bodega Local" 
            });
        });
        try { await Promise.all(promises); toast.info("📦 Stock devuelto"); } 
        catch (error) { toast.error("Error al devolver stock"); }
    };

    const handleReleaseFunds = async (movement) => {
        if (!confirm(`¿Confirmar liberación de fondos?`)) return;
        const promise = updateMovement(movement.id, { 
            ...movement, status: 'confirmed', description: `${movement.description} (Liberado ${new Date().toLocaleDateString()})`
        });
        toast.promise(promise, { loading: 'Liberando...', success: '💰 Fondos disponibles', error: 'Error' });
    };

    const handleSave = async () => {
        if (formData.isEcommerce && (!formData.receivedAmount || !formData.description)) {
            toast.error("Faltan datos", { description: "Ingrese monto recibido y descripción." });
            return;
        } else if (!formData.isEcommerce && (!formData.totalAmount || !formData.description)) {
            toast.error("Faltan datos", { description: "Ingrese monto y descripción." });
            return;
        }

        const promise = (async () => {
            let financialData = { ...formData };
            const isEcommerce = formData.isEcommerce === true;
            
            const isDigitalPayment = ["Mercado Pago"].includes(formData.paymentMethod);
            financialData.status = (isEcommerce || isDigitalPayment) ? 'pending' : 'confirmed';

            if (isEcommerce) {
                financialData = {
                    ...financialData,
                    totalAmount: formData.receivedAmount, 
                    netAmount: formData.receivedAmount,   
                    taxAmount: 0, 
                    description: `${formData.description} (Venta: $${Number(formData.totalAmount || 0).toLocaleString()} | Comis: $${Number(formData.commissionAmount || 0).toLocaleString()})`
                };
            }

            // 1. Guardar Movimiento Financiero
            if (editingId) {
                await updateMovement(editingId, financialData);
            } else {
                await addMovement(financialData);
            }

            // 2. Descontar Stock (Si es venta nueva)
            if (isEcommerce && formData.itemId && formData.warehouse && !editingId) {
                const item = inventory.find(i => i.id === formData.itemId);
                if (item) {
                    const currentStock = item.stocksByWarehouse?.[formData.warehouse] || 0;
                    if (currentStock >= formData.quantity) {
                        const updatedStocks = { ...item.stocksByWarehouse, [formData.warehouse]: currentStock - formData.quantity };
                        await updateItem(item.id, { ...item, stocksByWarehouse: updatedStocks });
                    } else throw new Error(`¡Stock insuficiente en ${formData.warehouse}!`);
                }
            }

            // 3. GENERAR ORDEN DE PAGO POR DELIVERY
            if (isEcommerce && formData.deliveryBy && !editingId) {
                const deliveryOrder = {
                    customer_id: null,
                    equipment_id: null,
                    customer_name: "Cliente E-commerce",
                    technician_name: formData.deliveryBy,
                    device_name: "Entrega a Domicilio",
                    device_type: "Otro",
                    job_type: "Delivery",
                    status: "Finalizado y Pagado", // Para que aparezca en Remuneraciones
                    reported_failure: `Envío de producto ID: ${formData.itemId}`,
                    location: "Terreno",
                    start_date: getChileTime(),
                    total_cost: DELIVERY_COST,
                    technician_paid: false,
                    items: [
                        {
                            id: 999999,
                            name: "Servicio de Delivery",
                            type: "Servicio", // Importante: Tipo Servicio para comisión
                            price: DELIVERY_COST,
                            quantity: 1
                        }
                    ]
                };

                const { error: deliveryError } = await supabase.from('work_orders').insert([deliveryOrder]);
                
                if (deliveryError) {
                    console.error("Error creando orden de delivery:", deliveryError);
                    if (deliveryError.message?.includes("technician_paid")) {
                        toast.warning("Falta actualizar la base de datos (columna technician_paid). Avise al administrador.");
                    } else {
                        toast.warning(`Error al asignar delivery: ${deliveryError.message}`);
                    }
                } else {
                    toast.success(`Delivery asignado a ${formData.deliveryBy} por $${DELIVERY_COST}`);
                }
            }

        })();

        toast.promise(promise, { loading: 'Guardando...', success: () => { setIsModalOpen(false); setIsEcommerceModalOpen(false); resetForm(); return 'Registro Guardado'; }, error: (err) => `Error: ${err.message}` });
    };

    const confirmDelete = (mov) => { setItemToDelete(mov); setIsDeleteModalOpen(true); };
    
    const handleDelete = async () => { 
        if (!itemToDelete) return; 
        try {
            if (itemToDelete.type === 'income' && itemToDelete.items && itemToDelete.items.length > 0) {
                await handleStockRestoration(itemToDelete.items);
            }
            await deleteMovement(itemToDelete.id); 
            setIsDeleteModalOpen(false); 
            setItemToDelete(null); 
            toast.success('Registro eliminado correctamente'); 
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar');
        }
    };

    const handleEdit = (mov) => { setEditingId(mov.id); setFormData(mov); if (mov.isEcommerce) { setIsEcommerceModalOpen(true); const item = inventory.find(i => i.id === mov.itemId); if(item) setSelectedItemName(item.name); } else { setIsModalOpen(true); } };
    const resetForm = () => { setFormData({ date: new Date().toISOString().split('T')[0], type: "income", docType: "39", docNumber: "", description: "", category: "VENTA", netAmount: 0, taxAmount: 0, totalAmount: 0, isTaxable: true, paymentMethod: "Mercado Pago", receivedAmount: 0, commissionAmount: 0, isEcommerce: false, itemId: "", warehouse: "Mercado Libre", quantity: 1, status: "confirmed", deliveryBy: "", docUrl: "" }); setEditingId(null); setItemSearchTerm(""); setSelectedItemName(""); setShowItemResults(false); };
    const updateAmounts = (value, field) => { let total = formData.totalAmount; let received = formData.receivedAmount; if (field === 'total') total = parseFloat(value) || 0; else if (field === 'received') received = parseFloat(value) || 0; const commission = total - received; let net = total; let tax = 0; if (formData.isTaxable && ["33", "39", "VOU"].includes(formData.docType)) { net = Math.round(total / 1.19); tax = total - net; } setFormData(prev => ({ ...prev, totalAmount: total, receivedAmount: received, commissionAmount: commission, netAmount: net, taxAmount: tax })); };

    // Filtros visuales (sobre la página actual)
    const filteredMovements = movements.filter(m => { 
        const matchesType = filterType === "Todos" || (filterType === "Ingresos" ? m.type === "income" : m.type === "expense"); 
        const formattedId = `MOV-${String(m.id).padStart(5, '0')}`;
        const matchesSearch = (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (m.docNumber || "").includes(searchTerm) || (formattedId.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch; 
    });

    if (loading && !stats) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando movimientos...</div>;

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">Flujo de Caja</h1><p className="text-slate-400 font-medium flex items-center gap-2"><Landmark size={14} className="text-brand-cyan" /> Control Financiero</p></div>
                <div className="flex gap-3 w-full md:w-auto"><button onClick={() => { resetForm(); setIsEcommerceModalOpen(true); setFormData(prev => ({ ...prev, isEcommerce: true, category: 'VENTA', paymentMethod: 'Mercado Pago', docType: '39', warehouse: 'Mercado Libre' })); }} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border border-white/10 shadow-lg"><ShoppingBag size={20} className="text-brand-cyan" /> Venta E-com</button><button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex-1 md:flex-none bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"><Plus size={20} /> Movimiento</button></div>
            </div>

            {/* KPI STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Saldo Disponible (Real)" value={`$${Number(stats?.available_balance || 0).toLocaleString()}`} icon={<CheckCircle size={24} className="text-emerald-400" />} color="text-emerald-400" borderColor="border-emerald-500/30" bgColor="bg-emerald-500/5" />
                <StatCard title="Saldo Retenido (En Tránsito)" value={`$${Number(stats?.pending_balance || 0).toLocaleString()}`} icon={<Clock size={24} className="text-amber-400" />} color="text-amber-400" borderColor="border-amber-500/30" bgColor="bg-amber-500/5" />
                <StatCard title="Egresos Totales" value={`$${Number(stats?.total_expense || 0).toLocaleString()}`} icon={<ArrowDownCircle size={24} className="text-rose-400" />} />
                <StatCard title="IVA Neto F29" value={`$${Number(stats?.net_iva || 0).toLocaleString()}`} icon={<Calculator size={24} className="text-brand-cyan" />} isSpecial />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Efectivo', val: stats?.cash_balance, icon: <Banknote size={24} />, col: 'text-emerald-400', bg: 'bg-emerald-500/10' }, 
                    { label: 'Banco de Chile', val: stats?.bank_balance, icon: <Landmark size={24} />, col: 'text-brand-purple', bg: 'bg-brand-purple/10' }, 
                    { label: 'Mercado Pago', val: stats?.mp_balance, icon: <CreditCard size={24} />, col: 'text-brand-cyan', bg: 'bg-brand-cyan/10' }
                ].map((b, i) => (<div key={i} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${b.bg} ${b.col}`}>{b.icon}</div><div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{b.label}</p><h3 className="text-xl font-black text-white italic tracking-tighter">${Number(b.val || 0).toLocaleString()}</h3></div></div>))}
            </div>

            {/* Filtros y Tabla */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex gap-2 items-center">
                    {["Todos", "Ingresos", "Egresos"].map((type) => (<button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${filterType === type ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>{type}</button>))}
                    <div className="w-px h-6 bg-white/10 mx-2"></div>
                    <div className="flex items-center gap-2 bg-slate-950/50 border border-white/10 rounded-xl px-3 py-1.5"><Calendar size={14} className="text-slate-500" /><input type="month" className="bg-transparent border-none text-xs font-bold text-white outline-none uppercase" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }} /></div>
                </div>
                <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" placeholder="Buscar MOV, ID, Cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 outline-none focus:border-brand-purple/50" /></div>
            </div>

            {/* Tabla */}
            {/* 👇 AQUÍ ESTÁ EL CAMBIO PRINCIPAL PARA EL SCROLL */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-950/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">ID</th> 
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Documento</th>
                                <th className="px-6 py-4">Glosa</th>
                                <th className="px-6 py-4 text-center">Cat.</th>
                                <th className="px-6 py-4">Pago</th>
                                <th className="px-6 py-4 text-right">Total</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredMovements.map((mov) => {
                                const isPending = mov.status === 'pending';
                                const docLabel = DOCUMENT_TYPES.find(d => d.id === mov.docType)?.label?.split(' ')[0] || mov.docType;
                                const formattedId = `MOV-${String(mov.id).padStart(5, '0')}`;

                                return (
                                    <tr key={mov.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4"><span className="font-mono text-[10px] text-brand-purple bg-brand-purple/10 px-2 py-1 rounded border border-brand-purple/20 flex items-center gap-1 w-fit"><Hash size={10} /> {formattedId}</span></td>
                                        <td className="px-6 py-4 text-slate-400 text-xs font-mono">{mov.date}</td>
                                        <td className="px-6 py-4">{isPending ? (<button onClick={() => handleReleaseFunds(mov)} className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-amber-500/20 transition-all group/btn" title="Clic para liberar"><Lock size={10} className="group-hover/btn:hidden" /><Unlock size={10} className="hidden group-hover/btn:block" /><span>Retenido</span></button>) : (<div className="flex items-center gap-1 text-emerald-500"><CheckCircle size={14} /><span className="text-[10px] font-bold uppercase">OK</span></div>)}</td>
                                        <td className="px-6 py-4"><div className="flex flex-col"><div className="flex items-center gap-1 mb-0.5"><span className="text-[10px] font-bold text-brand-purple uppercase">{docLabel}</span></div><span className="text-sm font-black text-white font-mono tracking-tight mb-1">{mov.docNumber ? `#${mov.docNumber}` : 'S/N'}</span>{mov.docUrl ? (<a href={mov.docUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-brand-cyan hover:text-white transition-colors w-fit"><Eye size={12} /> Ver PDF</a>) : (<div className="relative">{uploadingId === mov.id ? (<span className="text-[10px] text-slate-500 animate-pulse">Subiendo...</span>) : (<label className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-brand-cyan cursor-pointer w-fit transition-colors"><UploadCloud size={12} /> Adjuntar<input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleFileUpload(e, mov.id)} /></label>)}</div>)}</div></td>
                                        <td className="px-6 py-4 text-slate-300 text-sm max-w-xs"><div className="truncate">{mov.description}</div>{mov.deliveryBy && (<span className="block text-[9px] text-slate-500 mt-0.5 flex items-center gap-1"><Truck size={10} /> {mov.deliveryBy}</span>)}{mov.items && mov.items.length > 0 && (<button onClick={() => { setViewingItems(mov.items); setIsItemsModalOpen(true); }} className="mt-1 text-[10px] bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded border border-brand-purple/20 hover:bg-brand-purple/20 transition-all flex items-center gap-1 w-fit"><ShoppingBag size={10} /> Ver {mov.items.length} ítems</button>)}</td>
                                        <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-white/5 text-slate-400">{TAX_CATEGORIES.find(c => c.id === mov.category)?.label?.split(' ')[0]}</span></td>
                                        <td className="px-6 py-4"><span className="text-[10px] font-bold text-slate-300 uppercase px-2 py-1 bg-slate-800/50 rounded-lg border border-white/5">{mov.paymentMethod}</span></td>
                                        <td className="px-6 py-4 text-right"><span className={`text-sm font-black ${mov.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>{mov.type === 'income' ? '+' : '-'} ${Number(mov.totalAmount || 0).toLocaleString()}</span></td>
                                        <td className="px-6 py-4 text-right"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end"><button onClick={() => handleEdit(mov)} className="p-1.5 rounded-lg hover:bg-brand-cyan/10 text-slate-600 hover:text-brand-cyan"><Pencil size={14} /></button><button onClick={() => confirmDelete(mov)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-500"><Trash2 size={14} /></button></div></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {filteredMovements.length === 0 && <div className="py-20 text-center text-slate-500 font-medium">Sin movimientos en esta página.</div>}
                
                {/* Controles de Paginación */}
                <div className="flex justify-between items-center bg-slate-950/50 p-4 border-t border-white/10">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-50 text-white border border-white/5"><ChevronLeft size={20} /></button>
                    <span className="text-xs font-bold text-slate-400">Pág <span className="text-white text-sm">{page}</span> / {totalPages || 1}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-50 text-white border border-white/5"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* MODAL NUEVO/EDITAR MOVIMIENTO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center"><h2 className="text-xl font-black text-white italic uppercase">{editingId ? "Editar" : "Nuevo"} Movimiento</h2><button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button></div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5"><button onClick={() => setFormData({ ...formData, type: "income", category: "VENTA" })} className={`flex-1 py-2 rounded-lg font-bold ${formData.type === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>Ingreso</button><button onClick={() => setFormData({ ...formData, type: "expense", category: "MERCADERIA" })} className={`flex-1 py-2 rounded-lg font-bold ${formData.type === 'expense' ? 'bg-rose-500 text-white' : 'text-slate-500'}`}>Egreso</button></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha</label><input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Doc</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} /></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo Doc</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.docType} onChange={(e) => setFormData({ ...formData, docType: e.target.value })}>{DOCUMENT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div><div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Categoría</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>{TAX_CATEGORIES.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Glosa</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Medio Pago</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PAYMENT_METHODS.map(m => (
                                        <button key={m} onClick={() => setFormData({ ...formData, paymentMethod: m })} type="button" className={`py-2 rounded-lg text-[10px] font-bold border ${formData.paymentMethod === m ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{m}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4"><div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-400 uppercase">Calcular IVA</label><input type="checkbox" checked={formData.isTaxable} onChange={(e) => { setFormData(p => ({ ...p, isTaxable: e.target.checked })); setTimeout(() => updateAmounts(formData.totalAmount, 'total'), 0); }} /></div><div><label className="text-[10px] font-black text-brand-cyan uppercase block mb-1">Monto Total</label><input type="number" className="w-full bg-slate-900 border border-brand-cyan/30 rounded-xl p-3 text-white font-black text-xl outline-none" value={formData.totalAmount} onChange={(e) => updateAmounts(e.target.value, 'total')} /></div><div className="flex gap-4 text-xs text-slate-500"><span>Neto: ${formData.netAmount}</span><span>IVA: ${formData.taxAmount}</span></div></div>
                            <button onClick={handleSave} className="w-full bg-brand-gradient py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-lg hover:opacity-90">Guardar Movimiento</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL E-COMMERCE CON LA NUEVA LÓGICA DE DELIVERY */}
            {isEcommerceModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border-t-brand-cyan border-t-4">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900 sticky top-0 z-10"><div><h2 className="text-xl font-black text-white italic uppercase">Conciliación E-commerce</h2><p className="text-[10px] text-slate-400">Salida de Stock + Ingreso de Dinero (Retenido)</p></div><button onClick={() => setIsEcommerceModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button></div>
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><PackageMinus size={12} className="text-rose-400" /> 1. Producto vendido (Salida Stock)</label>
                                {selectedItemName ? (<div className="flex gap-2"><div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-bold text-sm">{selectedItemName}</div><button onClick={() => { setSelectedItemName(""); setItemSearchTerm(""); setFormData(p => ({...p, itemId: ""})); }} className="bg-slate-800 p-3 rounded-xl text-slate-400 hover:text-white border border-white/10"><Trash2 size={16} /></button></div>) : (<><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-brand-cyan" placeholder="Buscar producto..." value={itemSearchTerm} onChange={(e) => { setItemSearchTerm(e.target.value); setShowItemResults(true); }} />{showItemResults && (<div className="absolute z-20 w-full bg-slate-800 border border-white/10 rounded-xl mt-1 max-h-40 overflow-y-auto shadow-xl">{inventory.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).map(item => (<div key={item.id} onClick={() => { setFormData(prev => ({ ...prev, itemId: item.id, description: `Venta Ecom: ${item.name}`, totalAmount: item.price_sell })); setSelectedItemName(item.name); updateAmounts(item.price_sell, 'total'); setShowItemResults(false); }} className="p-3 hover:bg-white/5 cursor-pointer text-sm text-white border-b border-white/5 flex justify-between"><span>{item.name}</span><span className="text-brand-purple font-bold">${item.price_sell}</span></div>))}</div>)}</>)}
                            </div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Store size={12} /> Descontar de</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.warehouse} onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}>{WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div><div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cantidad</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-center font-mono" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} /></div></div>
                            <div className="bg-slate-950 p-5 rounded-2xl border border-white/5 relative overflow-hidden"><div className="absolute top-0 right-0 p-2 opacity-10"><Calculator size={100} className="text-white" /></div><label className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 relative z-10"><DollarSign size={12} /> 2. Conciliación Financiera</label><div className="space-y-3 relative z-10"><div className="flex justify-between items-center"><label className="text-xs text-slate-400">Precio Venta (Cliente)</label><div className="flex items-center w-40 bg-slate-900 border border-slate-700 rounded-lg px-2"><span className="text-slate-500 mr-1">$</span><input type="number" className="w-full bg-transparent p-2 text-right text-white font-bold outline-none" value={formData.totalAmount} onChange={(e) => updateAmounts(e.target.value, 'total')} /></div></div><div className="flex justify-between items-center"><label className="text-xs text-brand-cyan font-bold">Monto Recibido (Banco)</label><div className="flex items-center w-40 bg-slate-900 border border-brand-cyan/50 rounded-lg px-2 shadow-[0_0_10px_rgba(6,182,212,0.1)]"><span className="text-brand-cyan mr-1">$</span><input type="number" className="w-full bg-transparent p-2 text-right text-brand-cyan font-black outline-none" value={formData.receivedAmount} onChange={(e) => updateAmounts(e.target.value, 'received')} /></div></div><div className="h-px bg-white/10 my-2"></div><div className="flex justify-between items-center"><label className="text-xs text-rose-400 font-bold">Comisión / Costo Envío</label><div className="text-right font-mono text-rose-400 font-bold">- ${Number(formData.commissionAmount || 0).toLocaleString()}</div></div></div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Medio Pago</label>
                                    <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}>
                                        <option value="Mercado Pago">Mercado Pago</option>
                                        <option value="Banco de Chile">Banco de Chile</option>
                                    </select>
                                </div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Orden/Doc</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} placeholder="Ej: #12345" /></div></div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-2"><Truck size={12} /> Delivery realizado por</label>
                                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.deliveryBy} onChange={(e) => setFormData({ ...formData, deliveryBy: e.target.value })}>
                                    <option value="">-- Seleccionar Técnico --</option>
                                    {technicians.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <button onClick={handleSave} className="w-full bg-brand-gradient py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-lg hover:opacity-90">Confirmar Venta</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4"><div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300"><div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><AlertTriangle size={32} /></div><h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar Registro?</h2><p className="text-slate-400 mb-8 text-xs font-medium px-4">Esta acción borrará el movimiento contable permanentemente.</p><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest">Cancelar</button><button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic">Sí, Eliminar</button></div></div></div>
            )}

            {/* MODAL DETALLE DE ÍTEMS */}
            {isItemsModalOpen && viewingItems && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                            <h3 className="font-bold text-white flex items-center gap-2"><ShoppingBag size={18} className="text-brand-cyan"/> Detalle de Venta</h3>
                            <button onClick={() => setIsItemsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead className="text-slate-500 font-bold border-b border-white/5">
                                    <tr>
                                        <th className="pb-2">Producto</th>
                                        <th className="pb-2 text-center">Cant.</th>
                                        <th className="pb-2 text-right">Precio</th>
                                        <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewingItems.map((item, idx) => (
                                        <tr key={idx} className="text-slate-300">
                                            <td className="py-2 pr-2">{item.name || "Item sin nombre"}</td>
                                            <td className="py-2 text-center">{item.quantity || 1}</td>
                                            <td className="py-2 text-right">${Number(item.price || item.price_sell || 0).toLocaleString('es-CL')}</td>
                                            <td className="py-2 text-right font-bold text-brand-purple">
                                                ${(Number(item.price || item.price_sell || 0) * (item.quantity || 1)).toLocaleString('es-CL')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t border-white/10">
                                    <tr>
                                        <td colSpan="3" className="pt-3 text-right font-black text-slate-400 uppercase text-[10px]">Total Calculado</td>
                                        <td className="pt-3 text-right font-black text-white text-sm">
                                            ${viewingItems.reduce((acc, i) => acc + (Number(i.price || i.price_sell || 0) * (i.quantity || 1)), 0).toLocaleString('es-CL')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-950/50 border-t border-white/10">
                            <button onClick={() => setIsItemsModalOpen(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl font-bold text-xs transition-all">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Stateless Components (StatsCard se mantiene igual)
const StatCard = ({ title, value, icon, isSpecial, color, borderColor, bgColor }) => (
    <div className={`p-5 rounded-2xl border flex items-center gap-4 ${isSpecial ? 'bg-brand-purple/10 border-brand-purple/50' : (bgColor || 'bg-slate-900/50')} ${borderColor || 'border-white/5'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSpecial ? 'bg-brand-purple text-white' : 'bg-slate-800 text-slate-400'} ${color && !isSpecial ? color : ''}`}>{icon}</div>
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
            <h3 className={`text-2xl font-black italic tracking-tighter ${color || 'text-white'}`}>{value}</h3>
        </div>
    </div>
);

export default FlujoCaja;