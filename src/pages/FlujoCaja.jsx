import { useState, useEffect } from "react";
import {
    DollarSign, Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle,
    FileText, Calendar, PieChart, TrendingUp, Download, Trash2, Tag,
    Info, Calculator, Landmark, Pencil, CreditCard, Banknote, Percent,
    ShoppingBag, X
} from "lucide-react";
import { storage } from "../services/storage";

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
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEcommerceModalOpen, setIsEcommerceModalOpen] = useState(false);
    const [filterType, setFilterType] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [inventory, setInventory] = useState([]);
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [showItemResults, setShowItemResults] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: "income", // income or expense
        docType: "39", // Default Boleta
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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await storage.get('cash_flow_movements', []);
        setMovements(data);
        const invData = await storage.get('inventory_items', []);
        setInventory(invData || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.totalAmount || !formData.description) {
            alert("Por favor ingrese el monto y una descripción.");
            return;
        }

        if (editingId) {
            const updated = { ...formData, id: editingId };
            await storage.update('cash_flow_movements', updated);
            setMovements(movements.map(m => m.id === editingId ? updated : m));
        } else {
            const newMovement = {
                ...formData,
                id: `MOV-${Date.now()}`,
                created_at: new Date().toISOString()
            };
            const updatedMovements = [newMovement, ...movements];
            await storage.set('cash_flow_movements', updatedMovements);
            setMovements(updatedMovements);
        }

        // --- INVENTORY DEDUCTION LOGIC ---
        if (formData.isEcommerce && formData.itemId && formData.warehouse && !editingId) {
            const item = inventory.find(i => i.id === formData.itemId);
            if (item && item.stocksByWarehouse) {
                const currentStock = item.stocksByWarehouse[formData.warehouse] || 0;
                if (currentStock >= formData.quantity) {
                    const updatedStocks = {
                        ...item.stocksByWarehouse,
                        [formData.warehouse]: currentStock - formData.quantity
                    };
                    const updatedItem = {
                        ...item,
                        stocksByWarehouse: updatedStocks,
                        stock: Object.values(updatedStocks).reduce((a, b) => a + b, 0)
                    };
                    await storage.update('inventory_items', updatedItem);
                    setInventory(inventory.map(i => i.id === item.id ? updatedItem : i));
                } else {
                    alert(`Stock insuficiente en ${formData.warehouse}. Disponible: ${currentStock}`);
                    return;
                }
            }
        }

        setIsModalOpen(false);
        setIsEcommerceModalOpen(false);
        resetForm();
    };

    const handleEdit = (mov) => {
        setEditingId(mov.id);
        setFormData(mov);
        if (mov.isEcommerce) {
            setIsEcommerceModalOpen(true);
        } else {
            setIsModalOpen(true);
        }
    };

    const deleteMovement = async (id) => {
        if (confirm("¿Está seguro de eliminar este registro?")) {
            const updated = movements.filter(m => m.id !== id);
            await storage.set('cash_flow_movements', updated);
            setMovements(updated);
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

    // Auto-calculate Net/IVA
    const updateAmounts = (value, field) => {
        let total = formData.totalAmount;
        let net = formData.netAmount;
        let tax = formData.taxAmount;
        let received = formData.receivedAmount || 0;
        let commission = formData.commissionAmount || 0;

        if (field === 'total') {
            total = parseFloat(value) || 0;
            if (formData.isTaxable && (formData.docType === "33" || formData.docType === "39" || formData.docType === "VOU")) {
                net = Math.round(total / 1.19);
                tax = total - net;
            } else {
                net = total;
                tax = 0;
            }
            received = total; // Default received to total
            commission = 0;
        } else if (field === 'net') {
            net = parseFloat(value) || 0;
            if (formData.isTaxable && (formData.docType === "33" || formData.docType === "39" || formData.docType === "VOU")) {
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

    // Filter by Month first (Base for stats)
    const monthMovements = movements.filter(m => !filterMonth || m.date.startsWith(filterMonth));

    // Totals Calculations (Now period-based)
    const totalIncome = monthMovements
        .filter(m => m.type === "income")
        .reduce((acc, curr) => acc + Number(curr.totalAmount), 0);

    const totalExpense = monthMovements
        .filter(m => m.type === "expense")
        .reduce((acc, curr) => acc + Number(curr.totalAmount), 0);

    const ivaDebito = monthMovements
        .filter(m => m.type === "income")
        .reduce((acc, curr) => acc + Number(curr.taxAmount || 0), 0);

    const ivaCredito = monthMovements
        .filter(m => m.type === "expense")
        .reduce((acc, curr) => acc + Number(curr.taxAmount || 0), 0);

    const netIva = ivaDebito - ivaCredito;
    const balance = totalIncome - totalExpense;

    const totalCommissions = monthMovements
        .filter(m => m.type === "income")
        .reduce((acc, curr) => acc + Number(curr.commissionAmount || 0), 0);

    // Balance by Payment Method (Period based)
    const getBalanceByMethod = (method) => {
        const income = monthMovements
            .filter(m => m.type === "income" && m.paymentMethod === method)
            .reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
        const expense = monthMovements
            .filter(m => m.type === "expense" && m.paymentMethod === method)
            .reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
        return income - expense;
    };

    const cashBalance = getBalanceByMethod('Efectivo');
    const bancoBalance = getBalanceByMethod('BancoChile');
    const mercadoBalance = getBalanceByMethod('Mercado Pago');

    const filteredMovements = monthMovements.filter(m => {
        const matchesType = filterType === "Todos" || (filterType === "Ingresos" ? m.type === "income" : m.type === "expense");
        const matchesSearch = (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.docNumber || "").includes(searchTerm);
        return matchesType && matchesSearch;
    });

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">
                        Flujo de Caja Tributario
                    </h1>
                    <p className="text-slate-400 font-medium flex items-center gap-2">
                        <Landmark size={14} className="text-brand-cyan" />
                        Registro según Ley de Contabilidad Simplificada (Propyme)
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => {
                            resetForm();
                            setIsEcommerceModalOpen(true);
                            setFormData(prev => ({
                                ...prev,
                                isEcommerce: true,
                                category: 'VENTA',
                                paymentMethod: 'Mercado Pago',
                                docType: '39'
                            }));
                        }}
                        className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border border-white/10"
                    >
                        <ShoppingBag size={20} className="text-brand-cyan" />
                        Venta E-commerce
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="flex-1 md:flex-none bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"
                    >
                        <Plus size={20} />
                        Nuevo Movimiento
                    </button>
                    <button className="p-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Ingresos Totales (Percibidos)"
                    value={`$${totalIncome.toLocaleString()}`}
                    icon={<ArrowUpCircle size={24} className="text-emerald-400" />}
                    trend="+12% vs mes anterior"
                />
                <StatCard
                    title="Egresos Totales (Pagados)"
                    value={`$${totalExpense.toLocaleString()}`}
                    icon={<ArrowDownCircle size={24} className="text-rose-400" />}
                    trend="-5% vs mes anterior"
                />
                <StatCard
                    title="IVA Neto Estimado"
                    value={`$${netIva.toLocaleString()}`}
                    icon={<Calculator size={24} className="text-brand-cyan" />}
                    description={netIva > 0 ? "A pago F29" : "Remanente"}
                    isSpecial
                />
                <StatCard
                    title="Caja Final Operativa"
                    value={`$${(balance - totalCommissions).toLocaleString()}`}
                    icon={<DollarSign size={24} className="text-brand-purple" />}
                    trend="Caja Final Acumulada"
                />
                <StatCard
                    title="Comisiones Ecommerce"
                    value={`$${totalCommissions.toLocaleString()}`}
                    icon={<Percent size={24} className="text-rose-400" />}
                    description="Pérdida por comisiones"
                />
            </div>

            {/* Balances by Channel */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <TrendingUp size={16} className="text-brand-cyan" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Saldos por Canal (Este Periodo)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                <Banknote size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efectivo</p>
                                <h3 className="text-xl font-black text-white italic tracking-tighter">${cashBalance.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest">Caja Física</div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-brand-purple/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple group-hover:scale-110 transition-transform">
                                <Landmark size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Banco Chile</p>
                                <h3 className="text-xl font-black text-white italic tracking-tighter">${bancoBalance.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-brand-purple/50 uppercase tracking-widest">Transferencias</div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-brand-cyan/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center text-brand-cyan group-hover:scale-110 transition-transform">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mercado Pago</p>
                                <h3 className="text-xl font-black text-white italic tracking-tighter">${mercadoBalance.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-brand-cyan/50 uppercase tracking-widest">Digital Payout</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {["Todos", "Ingresos", "Egresos"].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterType === type
                                ? "bg-white/10 text-white border border-white/10 shadow-inner"
                                : "text-slate-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {type}
                        </button>
                    ))}

                    <div className="w-px h-6 bg-white/10 mx-2"></div>

                    <div className="flex items-center gap-2 bg-slate-950/50 border border-white/10 rounded-xl px-3 py-1.5 transition-all focus-within:border-brand-purple/50">
                        <Calendar size={14} className="text-slate-500" />
                        <input
                            type="month"
                            className="bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer uppercase"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                        />
                    </div>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por glosa o documento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Movements List - Pro Table */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Documento</th>
                            <th className="px-6 py-4">Glosa / Concepto</th>
                            <th className="px-6 py-4 text-center">Categoría</th>
                            <th className="px-6 py-4">Pago</th>
                            <th className="px-6 py-4 text-right">Neto</th>
                            <th className="px-6 py-4 text-right">IVA</th>
                            <th className="px-6 py-4 text-right pr-10">Total</th>
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
                                <td className="px-6 py-4">
                                    <p className="text-slate-300 text-sm font-medium">{mov.description}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-white/5 text-slate-400">
                                            {TAX_CATEGORIES.find(c => c.id === mov.category)?.label}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-white/5 rounded-lg w-fit">
                                        {mov.paymentMethod === 'Mercado Pago' && <CreditCard size={12} className="text-blue-400" />}
                                        {mov.paymentMethod === 'Efectivo' && <Banknote size={12} className="text-emerald-400" />}
                                        {mov.paymentMethod === 'BancoChile' && <Landmark size={12} className="text-brand-purple" />}
                                        {mov.isEcommerce && <ShoppingBag size={12} className="text-brand-cyan" />}
                                        <span className="text-[10px] font-bold text-slate-300 uppercase">{mov.paymentMethod || 'Otro'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">${Number(mov.netAmount).toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">${Number(mov.taxAmount).toLocaleString()}</td>
                                <td className="px-6 py-4 text-right pr-10">
                                    <div className="flex items-center justify-end gap-3">
                                        <span className={`text-sm font-black ${mov.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {mov.type === 'income' ? '+' : '-'} ${Number(mov.totalAmount).toLocaleString()}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => handleEdit(mov)}
                                                className="p-1.5 rounded-lg hover:bg-brand-cyan/10 text-slate-600 hover:text-brand-cyan"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteMovement(mov.id)}
                                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredMovements.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center">
                        <TrendingUp size={48} className="text-slate-800 mb-4" />
                        <p className="text-slate-500 font-medium">Sin movimientos registrados en este periodo.</p>
                    </div>
                )}
            </div>

            {/* --- STANDARD MOVEMENT MODAL --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-lg">
                                    <Calculator size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight">
                                        {editingId ? "Editar Movimiento" : "Registrar Movimiento"}
                                    </h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Contabilidad Simplificada</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Toggle Type */}
                            <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl border border-white/5 mb-2">
                                <button
                                    onClick={() => setFormData({ ...formData, type: "income", category: "VENTA" })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${formData.type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowUpCircle size={18} /> Ingreso
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, type: "expense", category: "MERCADERIA" })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${formData.type === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowDownCircle size={18} /> Egreso
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Fecha</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none font-mono text-sm"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">N° Documento</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none font-mono text-sm"
                                        placeholder="Ej: 502"
                                        value={formData.docNumber}
                                        onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Tipo Documento</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm appearance-none"
                                        value={formData.docType}
                                        onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                                    >
                                        {DOCUMENT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Categoría SII</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {TAX_CATEGORIES.filter(c => c.type === formData.type).map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Glosa / Concepto</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm"
                                    placeholder="Ej: Pago arriendo mes Diciembre"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Medio de Pago</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Efectivo', 'BancoChile', 'Mercado Pago'].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, paymentMethod: m })}
                                            className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${formData.paymentMethod === m ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_5px_rgba(75,225,236,0.8)]"></div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cálculo de Impuestos (19%)</p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={formData.isTaxable}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData(prev => ({ ...prev, isTaxable: checked }));
                                                setTimeout(() => updateAmounts(formData.totalAmount, 'total'), 0);
                                            }}
                                        />
                                        <div className={`w-8 h-4 rounded-full transition-all relative ${formData.isTaxable ? 'bg-brand-purple' : 'bg-slate-700'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${formData.isTaxable ? 'left-4.5' : 'left-0.5'}`}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Afecto a IVA</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="text-[9px] font-bold text-slate-600 mb-1 block uppercase">Monto Neto</label>
                                        <DollarSign className="absolute left-3 bottom-3 text-slate-600" size={14} />
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-white text-sm outline-none"
                                            value={formData.netAmount}
                                            onChange={(e) => updateAmounts(e.target.value, 'net')}
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="text-[9px] font-bold text-slate-600 mb-1 block uppercase">IVA (19%)</label>
                                        <DollarSign className="absolute left-3 bottom-3 text-slate-600" size={14} />
                                        <input
                                            type="number"
                                            disabled
                                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-slate-500 text-sm outline-none"
                                            value={formData.taxAmount}
                                        />
                                    </div>
                                </div>

                                <div className="relative">
                                    <label className="text-[10px] font-black text-brand-cyan mb-1 block uppercase tracking-[0.1em]">Monto Total Percibido/Pagado</label>
                                    <DollarSign className="absolute left-4 bottom-4 text-brand-cyan" size={20} />
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border-2 border-brand-cyan/20 rounded-xl py-3 pl-10 pr-4 text-white font-black text-xl outline-none focus:border-brand-cyan transition-all"
                                        placeholder="0"
                                        value={formData.totalAmount}
                                        onChange={(e) => updateAmounts(e.target.value, 'total')}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full bg-brand-gradient py-4 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-purple/20 hover:opacity-90 hover:scale-[1.01] active:scale-95 transition-all mt-2"
                            >
                                {editingId ? "Actualizar Registro" : "Registrar en Libro de Caja"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- E-COMMERCE SALE MODAL --- */}
            {isEcommerceModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col border-t-brand-cyan border-t-4">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-brand-cyan shadow-lg">
                                    <ShoppingBag size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight">
                                        Venta E-commerce
                                    </h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Registro de Venta con Comisión</p>
                                </div>
                            </div>
                            <button onClick={() => setIsEcommerceModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {/* SEARCH PRODUCT */}
                            <div className="relative">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Buscar Producto en Inventario</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="text"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-brand-cyan transition-all"
                                        placeholder="Escribe nombre o SKU del producto..."
                                        value={itemSearchTerm}
                                        onChange={(e) => {
                                            setItemSearchTerm(e.target.value);
                                            setShowItemResults(true);
                                        }}
                                        onFocus={() => setShowItemResults(true)}
                                    />
                                </div>

                                {showItemResults && itemSearchTerm && (
                                    <div className="absolute z-[110] left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                                        {inventory
                                            .filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || i.sku?.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                                            .map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            itemId: item.id,
                                                            description: `Venta Ecom: ${item.name} (SKU: ${item.sku || 'N/A'})`,
                                                            totalAmount: item.price_sell || 0
                                                        }));
                                                        // Trigger amount calculation
                                                        updateAmounts(item.price_sell || 0, 'total');
                                                        setItemSearchTerm(item.name);
                                                        setShowItemResults(false);
                                                    }}
                                                    className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-none flex justify-between items-center"
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{item.name}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">SKU: {item.sku || 'N/A'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-brand-cyan shadow-sm">${(item.price_sell || 0).toLocaleString()}</p>
                                                        <p className="text-[9px] text-slate-500">Stock: {item.stock || 0}</p>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                        {inventory.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).length === 0 && (
                                            <p className="p-4 text-center text-slate-500 text-xs">No se encontraron productos.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Bodega a Descontar</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm appearance-none"
                                        value={formData.warehouse}
                                        onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                                    >
                                        <option value="Bodega Local">🏠 Bodega Local</option>
                                        <option value="Mercado Libre">📦 Mercado Libre</option>
                                        <option value="Mercado Full">⚡ Mercado Full</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Cantidad</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none font-mono text-sm"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Fecha Venta</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none font-mono text-sm"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">N° Orden / Ref</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none font-mono text-sm"
                                        placeholder="Ej: #23456"
                                        value={formData.docNumber}
                                        onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Canal de Pago</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm"
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                    >
                                        <option value="Mercado Pago">Mercado Pago</option>
                                        <option value="BancoChile">BancoChile</option>
                                        <option value="Efectivo">Efectivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Documento</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-brand-purple outline-none text-sm"
                                        value={formData.docType}
                                        onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                                    >
                                        <option value="39">Boleta Electrónica</option>
                                        <option value="VOU">Voucher / Transbank</option>
                                        <option value="33">Factura Electrónica</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-4">
                                <div className="relative">
                                    <label className="text-[10px] font-black text-brand-cyan mb-1 block uppercase tracking-widest">Monto Total de la Venta (Bruto)</label>
                                    <DollarSign className="absolute left-4 bottom-4 text-brand-cyan" size={20} />
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border-2 border-brand-cyan/20 rounded-xl py-3 pl-10 pr-4 text-white font-black text-xl outline-none focus:border-brand-cyan"
                                        placeholder="0"
                                        value={formData.totalAmount}
                                        onChange={(e) => updateAmounts(e.target.value, 'total')}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="relative">
                                        <label className="text-[9px] font-bold text-slate-600 mb-1 block uppercase">Recibido Real (Líquido)</label>
                                        <DollarSign className="absolute left-3 bottom-3 text-slate-600" size={14} />
                                        <input
                                            type="number"
                                            className="w-full bg-slate-800 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-white text-sm outline-none focus:border-brand-purple"
                                            value={formData.receivedAmount}
                                            onChange={(e) => updateAmounts(e.target.value, 'received')}
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="text-[9px] font-bold text-slate-600 mb-1 block uppercase">Comisión Plataforma</label>
                                        <DollarSign className="absolute left-3 bottom-3 text-slate-600" size={14} />
                                        <input
                                            type="number"
                                            disabled
                                            className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-rose-400 text-sm outline-none font-bold"
                                            value={formData.commissionAmount}
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-brand-cyan/5 border border-brand-cyan/10 rounded-xl italic">
                                    <p className="text-[10px] text-brand-cyan leading-tight">
                                        <strong>Resumen Venta:</strong> Al guardar, se descontarán {formData.quantity} unidad(es) de "{formData.warehouse}" y se registrará un ingreso neto de ${formData.receivedAmount.toLocaleString()}.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full bg-brand-gradient py-4 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-purple/20 hover:opacity-90 hover:scale-[1.01] active:scale-95 transition-all mt-2"
                            >
                                {editingId ? "Actualizar Venta Ecom" : "Registrar Venta E-commerce"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Internal Components
const StatCard = ({ title, value, icon, trend, description, isSpecial }) => (
    <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all group relative overflow-hidden ${isSpecial ? 'bg-brand-purple/10 border-brand-purple/50 shadow-lg shadow-brand-purple/20' : 'bg-slate-900/50 border-white/5 hover:border-white/10'
        }`}>
        {isSpecial && <div className="absolute top-0 right-0 p-2 bg-brand-purple text-white rounded-bl-xl font-black text-[8px] uppercase tracking-widest animate-pulse">Impuesto F29</div>}
        <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${isSpecial ? 'bg-brand-purple text-white shadow-xl shadow-brand-purple/50' : 'bg-slate-800 text-slate-400'}`}>
                {icon}
            </div>
            <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{title}</p>
                <h3 className={`text-2xl font-black tracking-tighter mt-1 ${isSpecial ? 'text-white' : 'text-slate-100'}`}>{value}</h3>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {trend && (
                <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-brand-cyan" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{trend}</span>
                </div>
            )}
            {description && (
                <div className="flex items-center gap-1">
                    <Info size={12} className="text-yellow-500" />
                    <span className="text-[10px] font-black text-brand-cyan uppercase tracking-widest">{description}</span>
                </div>
            )}
        </div>
    </div>
);

export default FlujoCaja;
