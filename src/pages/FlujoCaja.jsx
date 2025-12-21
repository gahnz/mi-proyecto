import { useState } from "react";
import {
    DollarSign, Plus, Search, ArrowUpCircle, ArrowDownCircle,
    FileText, Calendar, TrendingUp, Download, Trash2,
    Info, Calculator, Landmark, Pencil, CreditCard, Banknote, Percent,
    ShoppingBag, X, AlertTriangle
} from "lucide-react";
import { toast } from "sonner"; // 👈 Toast
import { useCashFlow } from "../hooks/useCashFlow";
import { useInventory } from "../hooks/useInventory";

const DOCUMENT_TYPES = [
    { id: "33", label: "Factura Electrónica" },
    { id: "34", label: "Factura No Afecta o Exenta" },
    { id: "39", label: "Boleta Electrónica" },
    { id: "41", label: "Boleta No Afecta o Exenta" },
    { id: "61", label: "Nota de Crédito" },
    { id: "BH", label: "Boleta de Honorarios" },
    { id: "VOU", label: "Voucher / Transbank" },
    { id: "COM", label: "Comprobante de Gasto" },
    { id: "OTR", label: "Otro" }
];

const TAX_CATEGORIES = [
    { id: "VENTA", label: "Venta de Servicios/Productos", type: "income" },
    { id: "MERCADERIA", label: "Compra de Mercadería / Repuestos", type: "expense" },
    { id: "REMUNERACION", label: "Remuneraciones / Sueldos", type: "expense" },
    { id: "ARRIENDO", label: "Arriendo de Local", type: "expense" },
    { id: "SERVICIOS", label: "Servicios Básicos (Luz, Agua, Internet)", type: "expense" },
    { id: "HONORARIOS", label: "Honorarios Profesionales", type: "expense" },
    { id: "HERRAMIENTAS", label: "Herramientas e Insumos", type: "expense" },
    { id: "IMPUESTOS", label: "Pago de Impuestos (F29/F22)", type: "expense" },
    { id: "RETIRO", label: "Retiro de Socios", type: "expense" },
    { id: "G_GENERAL", label: "Gasto General / Otros", type: "expense" }
];

const FlujoCaja = () => {
    const { movements, loading, addMovement, updateMovement, deleteMovement } = useCashFlow();
    const { inventory, updateItem } = useInventory();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEcommerceModalOpen, setIsEcommerceModalOpen] = useState(false);
    const [filterType, setFilterType] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
    
    // UI Helpers
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [showItemResults, setShowItemResults] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

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
        paymentMethod: "Efectivo",
        receivedAmount: 0,
        commissionAmount: 0,
        isEcommerce: false,
        itemId: "",
        warehouse: "Bodega Local",
        quantity: 1
    });

    const handleSave = async () => {
        if (!formData.totalAmount || !formData.description) {
            toast.error("Faltan datos", { description: "Debe ingresar monto y descripción." });
            return;
        }

        const promise = (async () => {
            if (editingId) {
                await updateMovement(editingId, formData);
            } else {
                await addMovement(formData);
            }

            // Logic for E-commerce stock deduction
            if (formData.isEcommerce && formData.itemId && formData.warehouse && !editingId) {
                const item = inventory.find(i => i.id === formData.itemId);
                if (item) {
                    const currentStock = item.stocksByWarehouse?.[formData.warehouse] || 0;
                    if (currentStock >= formData.quantity) {
                        const updatedStocks = {
                            ...item.stocksByWarehouse,
                            [formData.warehouse]: currentStock - formData.quantity
                        };
                        await updateItem(item.id, { ...item, stocksByWarehouse: updatedStocks });
                    } else {
                        throw new Error(`Stock insuficiente en ${formData.warehouse}. Venta registrada sin descuento de stock.`);
                    }
                }
            }
        })();

        toast.promise(promise, {
            loading: 'Guardando movimiento...',
            success: () => {
                setIsModalOpen(false);
                setIsEcommerceModalOpen(false);
                resetForm();
                return 'Movimiento registrado correctamente';
            },
            error: (err) => `Atención: ${err.message}`
        });
    };

    const confirmDelete = (mov) => {
        setItemToDelete(mov);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;

        const promise = deleteMovement(itemToDelete.id);

        toast.promise(promise, {
            loading: 'Eliminando registro...',
            success: () => {
                setIsDeleteModalOpen(false);
                setItemToDelete(null);
                return 'Registro eliminado';
            },
            error: (err) => `Error: ${err.message}`
        });
    };

    // ... (El resto de funciones auxiliares resetForm, updateAmounts, cálculos se mantienen igual)
    const handleEdit = (mov) => {
        setEditingId(mov.id);
        setFormData(mov);
        if (mov.isEcommerce) {
            setIsEcommerceModalOpen(true);
        } else {
            setIsModalOpen(true);
        }
    };

    const resetForm = () => {
        setFormData({
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
            paymentMethod: "Efectivo",
            receivedAmount: 0,
            commissionAmount: 0,
            isEcommerce: false,
            itemId: "",
            warehouse: "Bodega Local",
            quantity: 1
        });
        setEditingId(null);
        setItemSearchTerm("");
        setShowItemResults(false);
    };

    const updateAmounts = (value, field) => {
        let total = formData.totalAmount;
        let net = formData.netAmount;
        let tax = formData.taxAmount;
        let received = formData.receivedAmount || 0;
        let commission = formData.commissionAmount || 0;

        if (field === 'total') {
            total = parseFloat(value) || 0;
            if (formData.isTaxable && ["33", "39", "VOU"].includes(formData.docType)) {
                net = Math.round(total / 1.19);
                tax = total - net;
            } else {
                net = total;
                tax = 0;
            }
            received = total;
            commission = 0;
        } else if (field === 'net') {
            net = parseFloat(value) || 0;
            if (formData.isTaxable && ["33", "39", "VOU"].includes(formData.docType)) {
                tax = Math.round(net * 0.19);
                total = net + tax;
            } else {
                total = net;
                tax = 0;
            }
            received = total;
            commission = 0;
        } else if (field === 'received') {
            received = parseFloat(value) || 0;
            commission = total - received;
        }

        setFormData(prev => ({
            ...prev,
            netAmount: net,
            taxAmount: tax,
            totalAmount: total,
            receivedAmount: received,
            commissionAmount: commission
        }));
    };

    const monthMovements = movements.filter(m => !filterMonth || m.date.startsWith(filterMonth));
    const totalIncome = monthMovements.filter(m => m.type === "income").reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
    const totalExpense = monthMovements.filter(m => m.type === "expense").reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
    const ivaDebito = monthMovements.filter(m => m.type === "income").reduce((acc, curr) => acc + Number(curr.taxAmount || 0), 0);
    const ivaCredito = monthMovements.filter(m => m.type === "expense").reduce((acc, curr) => acc + Number(curr.taxAmount || 0), 0);
    const netIva = ivaDebito - ivaCredito;
    const balance = totalIncome - totalExpense;

    const getBalanceByMethod = (method) => {
        const income = monthMovements.filter(m => m.type === "income" && m.paymentMethod === method).reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
        const expense = monthMovements.filter(m => m.type === "expense" && m.paymentMethod === method).reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
        return income - expense;
    };

    const cashBalance = getBalanceByMethod('Efectivo');
    const bancoBalance = getBalanceByMethod('BancoChile');
    const mercadoBalance = getBalanceByMethod('Mercado Pago');

    const filteredMovements = monthMovements.filter(m => {
        const matchesType = filterType === "Todos" || (filterType === "Ingresos" ? m.type === "income" : m.type === "expense");
        const matchesSearch = (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.docNumber || "").includes(searchTerm);
        return matchesType && matchesSearch;
    });

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando movimientos...</div>;

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* ... HEADER, STATS, FILTERS (Igual que antes) ... */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">
                        Flujo de Caja
                    </h1>
                    <p className="text-slate-400 font-medium flex items-center gap-2">
                        <Landmark size={14} className="text-brand-cyan" />
                        Movimientos Reales (Conectado a BD)
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => {
                            resetForm();
                            setIsEcommerceModalOpen(true);
                            setFormData(prev => ({ ...prev, isEcommerce: true, category: 'VENTA', paymentMethod: 'Mercado Pago', docType: '39' }));
                        }}
                        className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border border-white/10"
                    >
                        <ShoppingBag size={20} className="text-brand-cyan" />
                        Venta E-com
                    </button>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex-1 md:flex-none bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"
                    >
                        <Plus size={20} />
                        Movimiento
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Ingresos Totales" value={`$${totalIncome.toLocaleString()}`} icon={<ArrowUpCircle size={24} className="text-emerald-400" />} />
                <StatCard title="Egresos Totales" value={`$${totalExpense.toLocaleString()}`} icon={<ArrowDownCircle size={24} className="text-rose-400" />} />
                <StatCard title="IVA Neto F29" value={`$${netIva.toLocaleString()}`} icon={<Calculator size={24} className="text-brand-cyan" />} isSpecial />
                <StatCard title="Balance Operativo" value={`$${balance.toLocaleString()}`} icon={<DollarSign size={24} className="text-brand-purple" />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Efectivo', val: cashBalance, icon: <Banknote size={24} />, col: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Banco Chile', val: bancoBalance, icon: <Landmark size={24} />, col: 'text-brand-purple', bg: 'bg-brand-purple/10' },
                    { label: 'Mercado Pago', val: mercadoBalance, icon: <CreditCard size={24} />, col: 'text-brand-cyan', bg: 'bg-brand-cyan/10' }
                ].map((b, i) => (
                    <div key={i} className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${b.bg} ${b.col}`}>{b.icon}</div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{b.label}</p>
                            <h3 className="text-xl font-black text-white italic tracking-tighter">${b.val.toLocaleString()}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex gap-2 items-center">
                    {["Todos", "Ingresos", "Egresos"].map((type) => (
                        <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${filterType === type ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>{type}</button>
                    ))}
                    <div className="w-px h-6 bg-white/10 mx-2"></div>
                    <div className="flex items-center gap-2 bg-slate-950/50 border border-white/10 rounded-xl px-3 py-1.5">
                        <Calendar size={14} className="text-slate-500" />
                        <input type="month" className="bg-transparent border-none text-xs font-bold text-white outline-none uppercase" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
                    </div>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 outline-none focus:border-brand-purple/50" />
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-950/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Documento</th>
                            <th className="px-6 py-4">Glosa</th>
                            <th className="px-6 py-4 text-center">Cat.</th>
                            <th className="px-6 py-4">Pago</th>
                            <th className="px-6 py-4 text-right">Total</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredMovements.map((mov) => (
                            <tr key={mov.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4 text-slate-400 text-xs font-mono">{mov.date}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mov.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            <FileText size={14} />
                                        </div>
                                        <div>
                                            <p className="text-white text-xs font-bold">{DOCUMENT_TYPES.find(d => d.id === mov.docType)?.label}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">#{mov.docNumber || 'S/N'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-300 text-sm">{mov.description}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-white/5 text-slate-400">{TAX_CATEGORIES.find(c => c.id === mov.category)?.label?.split(' ')[0]}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase px-2 py-1 bg-slate-800/50 rounded-lg border border-white/5">{mov.paymentMethod}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`text-sm font-black ${mov.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {mov.type === 'income' ? '+' : '-'} ${Number(mov.totalAmount).toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                                        <button onClick={() => handleEdit(mov)} className="p-1.5 rounded-lg hover:bg-brand-cyan/10 text-slate-600 hover:text-brand-cyan"><Pencil size={14} /></button>
                                        <button onClick={() => confirmDelete(mov)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-500"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredMovements.length === 0 && <div className="py-20 text-center text-slate-500 font-medium">Sin movimientos en este periodo.</div>}
            </div>

            {/* ... MODALES CON TOAST YA INTEGRADOS EN handleSave ... */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-black text-white italic uppercase">{editingId ? "Editar" : "Nuevo"} Movimiento</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5">
                                <button onClick={() => setFormData({ ...formData, type: "income", category: "VENTA" })} className={`flex-1 py-2 rounded-lg font-bold ${formData.type === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>Ingreso</button>
                                <button onClick={() => setFormData({ ...formData, type: "expense", category: "MERCADERIA" })} className={`flex-1 py-2 rounded-lg font-bold ${formData.type === 'expense' ? 'bg-rose-500 text-white' : 'text-slate-500'}`}>Egreso</button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha</label><input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Doc</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo Doc</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.docType} onChange={(e) => setFormData({ ...formData, docType: e.target.value })}>{DOCUMENT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Categoría</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>{TAX_CATEGORIES.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                            </div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Glosa</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Medio Pago</label><div className="grid grid-cols-3 gap-2">{['Efectivo', 'BancoChile', 'Mercado Pago'].map(m => <button key={m} onClick={() => setFormData({ ...formData, paymentMethod: m })} type="button" className={`py-2 rounded-lg text-[10px] font-bold border ${formData.paymentMethod === m ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{m}</button>)}</div></div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
                                <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-400 uppercase">Calcular IVA</label><input type="checkbox" checked={formData.isTaxable} onChange={(e) => { setFormData(p => ({ ...p, isTaxable: e.target.checked })); setTimeout(() => updateAmounts(formData.totalAmount, 'total'), 0); }} /></div>
                                <div><label className="text-[10px] font-black text-brand-cyan uppercase block mb-1">Monto Total</label><input type="number" className="w-full bg-slate-900 border border-brand-cyan/30 rounded-xl p-3 text-white font-black text-xl outline-none" value={formData.totalAmount} onChange={(e) => updateAmounts(e.target.value, 'total')} /></div>
                                <div className="flex gap-4 text-xs text-slate-500"><span>Neto: ${formData.netAmount}</span><span>IVA: ${formData.taxAmount}</span></div>
                            </div>
                            <button onClick={handleSave} className="w-full bg-brand-gradient py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-lg hover:opacity-90">Guardar Movimiento</button>
                        </div>
                    </div>
                </div>
            )}

            {isEcommerceModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-t-brand-cyan border-t-4">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-black text-white italic uppercase">Venta E-commerce</h2>
                            <button onClick={() => setIsEcommerceModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Producto (Descuenta Stock)</label>
                                <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" placeholder="Buscar..." value={itemSearchTerm} onChange={(e) => { setItemSearchTerm(e.target.value); setShowItemResults(true); }} />
                                {showItemResults && (
                                    <div className="absolute z-10 w-full bg-slate-800 border border-white/10 rounded-xl mt-1 max-h-40 overflow-y-auto">
                                        {inventory.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).map(item => (
                                            <div key={item.id} onClick={() => { setFormData(prev => ({ ...prev, itemId: item.id, description: `Venta Ecom: ${item.name}`, totalAmount: item.price_sell })); updateAmounts(item.price_sell, 'total'); setItemSearchTerm(item.name); setShowItemResults(false); }} className="p-2 hover:bg-white/5 cursor-pointer text-sm text-white border-b border-white/5">
                                                {item.name} - ${item.price_sell}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bodega</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.warehouse} onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}><option value="Bodega Local">Bodega Local</option><option value="Mercado Libre">Mercado Libre</option></select></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cantidad</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} /></div>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
                                <div><label className="text-[10px] font-black text-brand-cyan uppercase block mb-1">Monto Venta</label><input type="number" className="w-full bg-slate-900 border border-brand-cyan/30 rounded-xl p-3 text-white font-black text-xl outline-none" value={formData.totalAmount} onChange={(e) => updateAmounts(e.target.value, 'total')} /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Recibido Real (Líquido)</label><input type="number" className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white outline-none" value={formData.receivedAmount} onChange={(e) => updateAmounts(e.target.value, 'received')} /></div>
                                <div className="text-xs text-rose-400 font-bold">Comisión: ${formData.commissionAmount}</div>
                            </div>
                            <button onClick={handleSave} className="w-full bg-brand-gradient py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-lg hover:opacity-90">Registrar Venta</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar Registro?</h2>
                        <p className="text-slate-400 mb-8 text-xs font-medium px-4">
                            Esta acción borrará el movimiento contable permanentemente.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Stateless Components
const StatCard = ({ title, value, icon, isSpecial }) => (
    <div className={`p-5 rounded-2xl border flex items-center gap-4 ${isSpecial ? 'bg-brand-purple/10 border-brand-purple/50' : 'bg-slate-900/50 border-white/5'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSpecial ? 'bg-brand-purple text-white' : 'bg-slate-800 text-slate-400'}`}>{icon}</div>
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
            <h3 className="text-2xl font-black text-white italic tracking-tighter">{value}</h3>
        </div>
    </div>
);

export default FlujoCaja;