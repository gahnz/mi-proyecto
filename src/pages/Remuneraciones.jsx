import { useState, useEffect, useMemo } from "react";
import { 
    Search, User, Calendar, DollarSign, Calculator, 
    CheckCircle2, FileText, TrendingUp, Percent, ArrowRight,
    AlertCircle, Settings, CheckSquare, Square, X, Wallet, Hash, FileSpreadsheet, Camera
} from "lucide-react";
import { supabase } from "../supabase/client";
import { useInventory } from "../hooks/useInventory"; 
import { toast } from "sonner";
import { getChileTime } from "../utils/time";
import { PAYMENT_METHODS, DOCUMENT_TYPES } from "../constants"; 

export default function Remuneraciones() {
    const { inventory } = useInventory(); 
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    
    // Estados de Selección y Pago
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    
    // Formulario de Pago
    const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
    const [paymentDate, setPaymentDate] = useState(getChileTime().split('T')[0]);
    const [glosa, setGlosa] = useState("");
    const [docType, setDocType] = useState("OTR");
    const [docNumber, setDocNumber] = useState("");

    const [selectedTech, setSelectedTech] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    
    // Tasas Configurable
    const [commissionRate, setCommissionRate] = useState(50);
    const [retentionRate, setRetentionRate] = useState(13.75);
    const [ivaRate, setIvaRate] = useState(19);

    useEffect(() => {
        const fetchTechs = async () => {
            const { data } = await supabase.from("profiles").select("full_name").in("role", ["tecnico", "coordinador"]);
            if (data) setTechnicians(data.map(t => t.full_name).filter(Boolean));
        };
        fetchTechs();
    }, []);

    const fetchWork = async () => {
        if (!selectedTech) return;
        setLoading(true);
        setSelectedIds(new Set()); 
        
        const startDate = `${selectedMonth}-01`;
        const endDate = `${selectedMonth}-31`;

        try {
            const { data, error } = await supabase
                .from("work_orders")
                .select("*")
                .eq("technician_name", selectedTech)
                .eq("status", "Finalizado y Pagado")
                .is("technician_paid", false) 
                .gte("created_at", startDate)
                .lte("created_at", endDate)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando trabajos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWork();
    }, [selectedTech, selectedMonth]);

    // --- CÁLCULOS POR ORDEN (Helper) ---
    const calculateOrderCommission = (order) => {
        let serviceBruto = 0;
        (order.items || []).forEach(item => {
            let type = item.type;
            if (!type && inventory.length > 0) {
                const invItem = inventory.find(i => i.id === item.id);
                if (invItem) type = invItem.type;
            }
            if (type === 'Servicio') serviceBruto += (Number(item.price) * (Number(item.quantity) || 1));
        });
        const serviceNeto = Math.round(serviceBruto / (1 + (ivaRate/100)));
        return Math.round(serviceNeto * (commissionRate/100));
    };

    // --- CÁLCULOS GLOBALES (KPIs Superiores) ---
    const stats = useMemo(() => {
        let totalVenta = 0;
        let montoComision = 0;

        orders.forEach(order => {
            totalVenta += (order.total_cost || 0);
            montoComision += calculateOrderCommission(order);
        });
        
        return { count: orders.length, totalVenta, montoComision };
    }, [orders, commissionRate, ivaRate, inventory]);

    // --- CÁLCULOS DE LA SELECCIÓN (CALCULADORA DERECHA) ---
    const selectionStats = useMemo(() => {
        let totalVentaSelected = 0;
        let totalComisionSelected = 0;

        orders.forEach(order => {
            if (selectedIds.has(order.id)) {
                totalVentaSelected += (order.total_cost || 0);
                totalComisionSelected += calculateOrderCommission(order);
            }
        });

        // Cálculo Boleta HONORARIOS (Solo sobre lo seleccionado)
        const factorRetencion = retentionRate / 100;
        const montoBruto = Math.round(totalComisionSelected / (1 - factorRetencion));
        const montoRetencion = Math.round(montoBruto * factorRetencion);

        return {
            count: selectedIds.size,
            totalVenta: totalVentaSelected,
            montoComision: totalComisionSelected, // Líquido
            montoBruto,
            montoRetencion
        };
    }, [selectedIds, orders, commissionRate, retentionRate, ivaRate, inventory]);

    // --- MANEJADORES DE SELECCIÓN ---
    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === orders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(orders.map(o => o.id)));
    };

    // --- ABRIR MODAL DE PAGO ---
    const handleOpenPayModal = () => {
        setGlosa(`Pago Nómina a ${selectedTech} (${selectedIds.size} trabajos)`);
        setDocNumber("");
        setIsPayModalOpen(true);
    };

    // --- PROCESAR PAGO ---
    const handleConfirmPayment = async () => {
        if (selectedIds.size === 0) return;
        if (!glosa) return toast.error("La glosa es obligatoria");
        
        const toastId = toast.loading("Procesando pago...");

        try {
            const { error: cashError } = await supabase.from('cash_flow').insert([{
                date: paymentDate,
                type: 'expense',
                category: 'REMUNERACION',
                description: glosa,
                payment_method: paymentMethod,
                total_amount: selectionStats.montoComision, // Guardamos el líquido pagado
                net_amount: selectionStats.montoComision,
                tax_amount: 0,
                status: 'confirmed',
                is_ecommerce: false,
                doc_type: docType,
                doc_number: docNumber
            }]);

            if (cashError) throw cashError;

            const uuidsToUpdate = orders
                .filter(o => selectedIds.has(o.id)) 
                .map(o => o.id);

            const { error: updateError } = await supabase
                .from('work_orders')
                .update({ technician_paid: true })
                .in('id', uuidsToUpdate);

            if (updateError) throw updateError;

            toast.success("Pago registrado correctamente", { id: toastId });
            setIsPayModalOpen(false);
            fetchWork(); 

        } catch (error) {
            console.error(error);
            toast.error("Error al registrar el pago", { id: toastId });
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-20 relative">
            {/* Header y Configuración */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">Nómina & Comisiones</h1>
                    <p className="text-slate-400 font-medium">Pago de servicios pendientes.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-white/5">
                        <span className="text-[10px] font-bold text-brand-purple uppercase">Comisión</span>
                        <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(Number(e.target.value))} className="w-10 bg-transparent text-center text-white font-bold text-sm outline-none border-b border-brand-purple/30 focus:border-brand-purple" /><span className="text-xs text-white font-bold">%</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-white/5">
                        <span className="text-[10px] font-bold text-brand-cyan uppercase">IVA</span>
                        <input type="number" value={ivaRate} onChange={(e) => setIvaRate(Number(e.target.value))} className="w-10 bg-transparent text-center text-white font-bold text-sm outline-none border-b border-brand-cyan/30 focus:border-brand-cyan" /><span className="text-xs text-white font-bold">%</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-white/5">
                        <span className="text-[10px] font-bold text-rose-400 uppercase">Retención</span>
                        <input type="number" value={retentionRate} onChange={(e) => setRetentionRate(Number(e.target.value))} className="w-12 bg-transparent text-center text-white font-bold text-sm outline-none border-b border-rose-400/30 focus:border-rose-400" /><span className="text-xs text-white font-bold">%</span>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Periodo</label><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-800 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-brand-cyan" /></div>
                <div className="space-y-1 flex-1 min-w-[200px]"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><User size={12}/> Técnico</label><select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-brand-purple"><option value="">-- Seleccionar Técnico --</option>{technicians.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>

            {selectedTech ? (
                <>
                    {/* KPI CARDS - RESUMEN GLOBAL */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><CheckCircle2 size={18} /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Total Pendientes</span></div>
                            <h3 className="text-2xl font-black text-white">{stats.count}</h3>
                        </div>
                        <div className="bg-slate-900 border border-white/5 p-5 rounded-2xl flex flex-col justify-between opacity-75">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-slate-800 rounded-lg text-slate-400"><DollarSign size={18} /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Monto Total Pendiente</span></div>
                            <h3 className="text-2xl font-black text-slate-300">${stats.montoComision.toLocaleString('es-CL')}</h3>
                        </div>
                    </div>

                    {/* 🔥 LAYOUT DIVIDIDO: TABLA + CALCULADORA 🔥 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* 1. TABLA (COLUMNA IZQUIERDA) */}
                        <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                            <div className="p-4 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
                                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2"><FileText size={16} className="text-slate-400"/> Listado de Órdenes</h3>
                                <span className="text-xs text-slate-500">Seleccionados: <span className="text-white font-bold">{selectedIds.size}</span></span>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar flex-1">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 w-10 text-center cursor-pointer hover:bg-white/5" onClick={toggleSelectAll}>
                                                {selectedIds.size > 0 && selectedIds.size === orders.length ? <CheckSquare size={16} className="text-brand-purple"/> : <Square size={16}/>}
                                            </th>
                                            <th className="p-4">Fecha / OT</th>
                                            <th className="p-4">Servicios Realizados</th>
                                            <th className="p-4 text-right">Valor Bruto</th>
                                            <th className="p-4 text-right">Comisión ({commissionRate}%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {orders.length === 0 ? (
                                            <tr><td colSpan="5" className="p-10 text-center text-slate-500 italic">No hay pagos pendientes para este periodo.</td></tr>
                                        ) : orders.map(order => {
                                            const comision = calculateOrderCommission(order);
                                            const isSelected = selectedIds.has(order.id);

                                            return (
                                                <tr key={order.id} onClick={() => toggleSelect(order.id)} className={`transition-colors cursor-pointer ${isSelected ? 'bg-brand-purple/10 hover:bg-brand-purple/20' : 'hover:bg-white/5'}`}>
                                                    <td className="p-4 text-center">
                                                        {isSelected ? <CheckSquare size={16} className="text-brand-purple mx-auto"/> : <Square size={16} className="text-slate-600 mx-auto"/>}
                                                    </td>
                                                    <td className="p-4"><div className="font-mono text-slate-400">{new Date(order.created_at).toLocaleDateString()}</div><div className="font-bold text-white">{order.order_id || order.id.slice(0,8)}</div></td>
                                                    <td className="p-4 text-[10px] text-slate-400 max-w-[200px]">
                                                        {(order.items || []).map((it, idx) => {
                                                            let type = it.type;
                                                            if (!type && inventory.length > 0) {
                                                                const invItem = inventory.find(i => i.id === it.id);
                                                                if (invItem) type = invItem.type;
                                                            }
                                                            if (type !== 'Servicio') return null;
                                                            return <div key={idx} className={`truncate ${isSelected ? 'text-brand-purple/80' : 'text-slate-300'}`}>{it.quantity}x {it.name}</div>
                                                        })}
                                                    </td>
                                                    <td className="p-4 text-right text-slate-500">${order.total_cost.toLocaleString('es-CL')}</td>
                                                    <td className={`p-4 text-right font-black ${isSelected ? 'text-brand-purple' : 'text-emerald-400'}`}>${comision.toLocaleString('es-CL')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2. CALCULADORA (COLUMNA DERECHA) */}
                        <div className="lg:col-span-1 bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col shadow-2xl h-fit sticky top-20">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-brand-gradient text-white rounded-xl shadow-lg shadow-brand-purple/20"><Calculator size={24}/></div>
                                <div>
                                    <h3 className="font-bold text-white uppercase tracking-tight">Calculadora Pago</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Para enviar al Técnico</p>
                                </div>
                            </div>

                            {selectedIds.size > 0 ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 space-y-3">
                                        <div className="flex justify-between items-center text-slate-400 text-xs">
                                            <span>Trabajos Seleccionados</span>
                                            <span className="font-bold text-white">{selectionStats.count}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-400 text-xs">
                                            <span>Venta Total (Servicios)</span>
                                            <span className="font-bold text-white">${selectionStats.totalVenta.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2"></div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-brand-purple font-bold uppercase">Comisión (Líquida)</span>
                                            <span className="text-lg font-mono font-bold text-white">${selectionStats.montoComision.toLocaleString('es-CL')}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 space-y-2">
                                        <div className="flex justify-between items-center text-amber-400 text-xs font-bold uppercase mb-2">
                                            <span>Datos Boleta SII</span>
                                            <Camera size={14} />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400">Monto Bruto</span>
                                            <span className="text-sm font-mono font-bold text-white">${selectionStats.montoBruto.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-rose-400">
                                            <span className="text-xs">Retención ({retentionRate}%)</span>
                                            <span className="text-sm font-mono font-bold">-${selectionStats.montoRetencion.toLocaleString('es-CL')}</span>
                                        </div>
                                        <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                                            <span className="text-xs text-emerald-400 font-black uppercase">A Recibir</span>
                                            <span className="text-xl font-black text-emerald-400">${selectionStats.montoComision.toLocaleString('es-CL')}</span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleOpenPayModal}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        <Wallet size={18} /> Pagar ${selectionStats.montoComision.toLocaleString('es-CL')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-600 border-2 border-dashed border-white/5 rounded-xl">
                                    <CheckSquare size={32} className="mb-2 opacity-50"/>
                                    <p className="text-xs font-bold uppercase text-center">Selecciona órdenes<br/>de la izquierda</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-50"><User size={64} className="mb-4" /><p className="text-sm font-bold uppercase tracking-widest">Selecciona un técnico para calcular</p></div>}

            {/* MODAL CONFIRMACIÓN PAGO */}
            {isPayModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-black text-white italic uppercase">Confirmar Pago</h2>
                                <p className="text-xs text-slate-400">Registrar egreso final en caja.</p>
                            </div>
                            <button onClick={() => setIsPayModalOpen(false)}><X className="text-slate-500 hover:text-white"/></button>
                        </div>

                        <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">Monto a Transferir</span>
                            <span className="text-3xl font-black text-white">${selectionStats.montoComision.toLocaleString('es-CL')}</span>
                        </div>

                        {/* Formulario */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Pago</label>
                                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Método</label>
                                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none">
                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Glosa</label>
                                <input type="text" value={glosa} onChange={(e) => setGlosa(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo Doc.</label>
                                    <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none">
                                        {DOCUMENT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nº Comprobante</label>
                                    <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none placeholder-slate-700" placeholder="Ej: 123456" />
                                </div>
                            </div>
                        </div>

                        <button onClick={handleConfirmPayment} className="w-full bg-brand-gradient text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:opacity-90 flex items-center justify-center gap-2">
                            <CheckCircle2 size={18}/> Confirmar y Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}