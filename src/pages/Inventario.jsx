import { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, AlertTriangle, Edit3, Trash2, X, Wrench, 
    Home, Truck, Zap, Smartphone, ShoppingCart, PackageCheck, 
    ClipboardList, Calendar, Hash, Clock, PackagePlus, DollarSign,
    CheckSquare, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner"; 
import { supabase } from "../supabase/client"; 
import { useInventory } from "../hooks/useInventory";
import { useEquipos } from "../hooks/useEquipos";

const WAREHOUSES = [
  { id: "Bodega Local", label: "Bodega Local", icon: <Home size={14} />, color: "bg-slate-800 text-slate-300" },
  { id: "Mercado Libre", label: "Mercado Libre", icon: <Truck size={14} />, color: "bg-blue-500 text-white" },
  { id: "Mercado Full", label: "Mercado Full", icon: <Zap size={14} />, color: "bg-yellow-400 text-black" }
];

export default function Inventario() {
  const { inventory: items, loading, addItem, updateItem, deleteItem, refreshInventory } = useInventory();
  const { equipments: availableEquipments } = useEquipos();

  const [activeTab, setActiveTab] = useState("inventory"); 

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [modelSearch, setModelSearch] = useState("");
  const [showModelOptions, setShowModelOptions] = useState(false);

  // ESTADOS DE COMPRAS
  const [orders, setOrders] = useState([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  // 👇 AGREGADO: trackingUrl
  const [newOrder, setNewOrder] = useState({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [] });
  const [itemSelectorSearch, setItemSelectorSearch] = useState("");

  const initialStocks = { "Bodega Local": 0, "Mercado Libre": 0, "Mercado Full": 0 };

  const [formData, setFormData] = useState({
    type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0,
    stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: []
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase.from('supply_orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const incomingItemIds = useMemo(() => {
      const ids = new Set();
      orders
        .filter(o => o.status === 'Pendiente')
        .forEach(order => {
            if (Array.isArray(order.items)) {
                order.items.forEach(item => ids.add(item.id));
            }
        });
      return ids;
  }, [orders]);

  const handleSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-brand-purple" /> : <ArrowDown size={12} className="text-brand-purple" />;
  };

  const handleAddItemToOrder = (item) => {
    const existing = newOrder.items.find(i => i.id === item.id);
    if (existing) return;
    setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { ...item, quantity: 1, purchase_cost: item.price_cost || 0 }]
    });
    setItemSelectorSearch(""); 
  };

  const updateOrderItem = (id, field, value) => {
    setNewOrder({
        ...newOrder,
        items: newOrder.items.map(i => i.id === id ? { ...i, [field]: Number(value) } : i)
    });
  };

  const removeOrderItem = (id) => {
    setNewOrder({ ...newOrder, items: newOrder.items.filter(i => i.id !== id) });
  };

  const submitOrder = async () => {
    if (!newOrder.supplier || newOrder.items.length === 0) {
        toast.error("Falta proveedor o items");
        return;
    }

    const total = newOrder.items.reduce((acc, i) => acc + (i.quantity * i.purchase_cost), 0);

    const { error } = await supabase.from('supply_orders').insert([{
        supplier_name: newOrder.supplier,
        items: newOrder.items,
        total_cost: total,
        status: 'Pendiente',
        tracking_code: newOrder.trackingCode,
        tracking_url: newOrder.trackingUrl, // 👈 GUARDAMOS LA URL
        estimated_delivery_date: newOrder.estimatedDate || null
    }]);

    if (error) { toast.error("Error al crear orden"); } 
    else {
        toast.success("Orden de compra creada");
        setIsOrderModalOpen(false);
        setNewOrder({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [] });
        fetchOrders();
    }
  };

  const handleReceiveOrder = async (order) => {
    if (!window.confirm("¿Confirmar recepción? Se sumará el stock a Bodega Local.")) return;

    const promises = order.items.map(async (item) => {
        const { data: currentData } = await supabase.from('inventory').select('stocks_by_warehouse').eq('id', item.id).single();
        if (currentData) {
            const currentStock = currentData.stocks_by_warehouse?.["Bodega Local"] || 0;
            const newStock = currentStock + item.quantity;
            const newStocksJson = { ...currentData.stocks_by_warehouse, "Bodega Local": newStock };
            await supabase.from('inventory').update({ stocks_by_warehouse: newStocksJson }).eq('id', item.id);
        }
    });

    await Promise.all(promises);
    await supabase.from('supply_orders').update({ status: 'Recibido', received_at: new Date().toISOString() }).eq('id', order.id);

    toast.success("📦 Stock recepcionado correctamente");
    fetchOrders();
    refreshInventory();
  };

  // --- LOGICA DE INVENTARIO ---
  const filteredEquips = availableEquipments.filter(eq => {
      const searchString = `${eq.brand} ${eq.model} ${eq.type}`.toLowerCase();
      return searchString.includes(modelSearch.toLowerCase());
  });
  const addCompatibleModel = (modelName) => { if (!formData.compatible_models.includes(modelName)) { setFormData({ ...formData, compatible_models: [...formData.compatible_models, modelName] }); } setModelSearch(""); };
  const removeCompatibleModel = (modelName) => { setFormData({ ...formData, compatible_models: formData.compatible_models.filter(m => m !== modelName) }); };
  const handleEdit = (item) => { setEditingId(item.id); setFormData({ type: item.type, name: item.name, sku: item.sku || "", price_sell: item.price_sell, price_cost: item.price_cost || 0, stocksByWarehouse: item.stocksByWarehouse || { ...initialStocks }, min_stock: item.min_stock, compatible_models: item.compatible_models || [] }); setIsModalOpen(true); };
  const confirmDelete = (item) => { setItemToDelete(item); setIsDeleteModalOpen(true); };
  const handleDelete = async () => { if (!itemToDelete) return; await deleteItem(itemToDelete.id); setIsDeleteModalOpen(false); setItemToDelete(null); toast.success("Ítem eliminado"); };
  const handleSubmit = async (e) => { e.preventDefault(); const promise = editingId ? updateItem(editingId, formData) : addItem(formData); toast.promise(promise, { loading: 'Guardando...', success: 'Guardado correctamente', error: 'Error al guardar' }); try { await promise; setIsModalOpen(false); setEditingId(null); resetForm(); } catch (error) { console.error(error); } };
  const resetForm = () => { setFormData({ type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0, stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: [] }); setEditingId(null); setModelSearch(""); };
  const updateWarehouseStock = (warehouseId, value) => { setFormData(prev => ({ ...prev, stocksByWarehouse: { ...prev.stocksByWarehouse, [warehouseId]: parseInt(value) || 0 } })); };
  
  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase())));
  
  const sortedItems = [...filteredItems].sort((a, b) => {
      if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc' 
              ? a.name.localeCompare(b.name) 
              : b.name.localeCompare(a.name);
      }
      if (sortConfig.key === 'totalStock') {
          const stockA = Object.values(a.stocksByWarehouse || {}).reduce((x, y) => x + y, 0);
          const stockB = Object.values(b.stocksByWarehouse || {}).reduce((x, y) => x + y, 0);
          return sortConfig.direction === 'asc' ? stockA - stockB : stockB - stockA;
      }
      return 0;
  });

  const itemsToBuy = items.filter(i => i.name.toLowerCase().includes(itemSelectorSearch.toLowerCase()) && i.type !== 'Servicio');

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Control de Inventario</h1>
          <div className="flex gap-4 mt-2">
            <button onClick={() => setActiveTab('inventory')} className={`text-sm font-bold uppercase tracking-wider pb-1 transition-all ${activeTab === 'inventory' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-slate-500 hover:text-white'}`}>Mis Productos</button>
            <button onClick={() => setActiveTab('purchases')} className={`text-sm font-bold uppercase tracking-wider pb-1 transition-all ${activeTab === 'purchases' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-slate-500 hover:text-white'}`}>Compras / Reposición</button>
          </div>
        </div>
        {activeTab === 'inventory' ? (
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-purple/30 text-xs"><Plus size={18} /> Nuevo Ítem</button>
        ) : (
            <button onClick={() => setIsOrderModalOpen(true)} className="bg-brand-cyan hover:bg-brand-cyan/80 text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-cyan/30 text-xs"><ShoppingCart size={18} /> Nueva Compra</button>
        )}
      </div>

      {/* VISTA 1: INVENTARIO */}
      {activeTab === 'inventory' && (
        <>
            <div className="bg-slate-900/50 p-4 rounded-2x border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" placeholder="Buscar por nombre o SKU..." className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                {loading && <span className="text-xs text-brand-purple animate-pulse font-bold uppercase">Sincronizando...</span>}
            </div>
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm shadow-xl">
                <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                    <tr>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-2">Ítem / Info {getSortIcon('name')}</div>
                        </th>
                        <th className="px-6 py-4">Distribución de Stock</th>
                        <th className="px-6 py-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalStock')}>
                            <div className="flex items-center justify-center gap-2">Total {getSortIcon('totalStock')}</div>
                        </th>
                        <th className="px-6 py-4 text-right">Precio Venta</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sortedItems.map((item) => { 
                    const totalStock = Object.values(item.stocksByWarehouse || {}).reduce((a, b) => a + b, 0);
                    const isIncoming = incomingItemIds.has(item.id);

                    return (
                        <tr key={item.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-6 py-4">
                            <div className="font-bold text-white uppercase text-sm tracking-tight flex items-center gap-2">
                                {item.name}
                                {isIncoming && (
                                    <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse" title="Hay una compra pendiente de recibir con este ítem">
                                        <PackagePlus size={12} /> EN CAMINO
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1"><span className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase font-black tracking-widest">{item.type}</span><span className="text-[10px] text-slate-500 font-mono tracking-tighter">SKU: {item.sku || 'N/A'}</span></div>
                        </td>
                        <td className="px-6 py-4"><div className="flex gap-2">{item.type === 'Servicio' ? (<span className="text-brand-purple text-[10px] font-black uppercase tracking-widest bg-brand-purple/10 px-3 py-1 rounded-lg border border-brand-purple/20">Servicio Intangible</span>) : (<>{WAREHOUSES.map(w => { const stock = item.stocksByWarehouse?.[w.id] || 0; if (stock === 0) return null; return (<div key={w.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-white/5 ${w.color}`}>{w.icon}<span className="text-[10px] font-black uppercase tracking-tighter">{stock}</span></div>); })} {(!item.stocksByWarehouse || Object.values(item.stocksByWarehouse).every(s => s === 0)) && (<span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Sin stock físico</span>)}</>)}</div></td>
                        <td className="px-6 py-4 text-center">{item.type === 'Servicio' ? <span className="text-slate-600 text-sm font-bold uppercase tracking-widest">—</span> : <span className={`text-lg font-black italic tracking-tighter ${totalStock <= item.min_stock ? "text-rose-500" : "text-brand-cyan"}`}>{totalStock}</span>}</td>
                        <td className="px-6 py-4 text-right text-white font-black italic text-lg tracking-tighter shadow-sm">${(item.price_sell || 0).toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4"><div className="flex justify-center gap-2 truncate"><button onClick={() => handleEdit(item)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all"><Edit3 size={18} /></button><button onClick={() => confirmDelete(item)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all"><Trash2 size={18} /></button></div></td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
        </>
      )}

      {/* VISTA 2: COMPRAS CON TRACKING Y URL */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center py-20 text-slate-500 italic">No hay órdenes de compra registradas.</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                    const isLate = order.estimated_delivery_date && new Date(order.estimated_delivery_date) < new Date() && order.status === 'Pendiente';
                    return (
                        <div key={order.id} className="bg-slate-900 border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group hover:border-brand-purple/30 transition-all shadow-xl flex flex-col justify-between h-full">
                            
                            {/* BADGE DE ESTADO FLOTANTE */}
                            {order.status === 'Recibido' && <div className="absolute right-0 top-0 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-emerald-500/20">Recibido</div>}
                            {order.status === 'Pendiente' && <div className="absolute right-0 top-0 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-yellow-500/20 animate-pulse">Pendiente</div>}

                            <div>
                                {/* HEADER: PROVEEDOR */}
                                <div className="mb-4 pr-16">
                                    <h3 className="text-lg font-black text-white italic leading-tight">{order.supplier_name}</h3>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-bold">
                                        <Calendar size={10} /> {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* TRACKING INFO CON LINK */}
                                {(order.estimated_delivery_date || order.tracking_code) && (
                                    <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
                                        {order.estimated_delivery_date && (
                                            <p className={`text-[10px] flex items-center gap-2 font-bold mb-1 ${isLate ? 'text-red-400' : 'text-brand-cyan'}`}>
                                                <Clock size={12} /> Llegada: {new Date(order.estimated_delivery_date).toLocaleDateString()}
                                            </p>
                                        )}
                                        {order.tracking_code && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-slate-300 flex items-center gap-2 font-mono">
                                                    <Hash size={12} /> {order.tracking_code}
                                                </p>
                                                {/* 🔥 BOTÓN DE SEGUIMIENTO */}
                                                {order.tracking_url && (
                                                    <a 
                                                        href={order.tracking_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-[9px] text-brand-purple hover:text-white flex items-center gap-1 font-bold uppercase hover:underline"
                                                    >
                                                        <ExternalLink size={10} /> Seguir
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ITEMS SUMMARY (SCROLLABLE) */}
                                <div className="bg-black/20 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto custom-scrollbar border border-white/5">
                                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                                        <ClipboardList size={10} /> {order.items.length} Items
                                    </div>
                                    <div className="space-y-1.5">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-slate-300 border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                <span className="truncate pr-2">{item.quantity}x <strong className="text-white">{item.name}</strong></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER: TOTAL Y ACCIÓN */}
                            <div className="pt-2 border-t border-white/10 mt-auto">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Orden</span>
                                    <span className="text-xl font-black text-white italic tracking-tighter flex items-center">
                                        <DollarSign size={14} className="text-slate-500 mr-0.5" />
                                        {order.total_cost.toLocaleString('es-CL')}
                                    </span>
                                </div>

                                {order.status === 'Pendiente' ? (
                                    <button 
                                        onClick={() => handleReceiveOrder(order)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        <PackageCheck size={14} /> Recibir Stock
                                    </button>
                                ) : (
                                    <div className="w-full bg-slate-800 text-slate-500 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 cursor-default opacity-50">
                                        <CheckSquare size={14} /> Finalizado
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* MODAL CREAR ITEM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border-t-brand-purple border-t-4 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
            {/* ... Formulario de items ... */}
            <div className="flex justify-between items-center p-8 pb-4">
              <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-lg"><Wrench size={24} /></div><div><h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{editingId ? 'Editar Ítem' : 'Nuevo Registro'}</h2><p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Gestión Centralizada Pro v2</p></div></div>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-800 hover:bg-white hover:text-slate-900 transition-all text-slate-400 p-2 rounded-xl"><X size={24} /></button>
            </div>
            <div className="p-8 pt-4 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Clasificación</label><div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">{["Repuesto", "Servicio", "Consumible"].map(t => (<button key={t} type="button" onClick={() => setFormData({ ...formData, type: t })} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${formData.type === t ? 'bg-brand-gradient text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>))}</div></div>
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Nombre Comercial</label><input required className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-bold" placeholder="Ej: Pantalla iPhone 13 OLED" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 font-mono">SKU / ID Interno</label><input className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-mono text-sm" placeholder="Ej: PANT-IP13-001" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} /></div><div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Stock Mínimo</label><input type="number" className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-bold" value={formData.min_stock} onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })} /></div></div>
                    <div className="bg-slate-950 p-6 rounded-3xl border border-white/5 space-y-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Costo ($)</label><input type="number" className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all text-sm" placeholder="0" value={formData.price_cost} onChange={(e) => setFormData({ ...formData, price_cost: parseFloat(e.target.value) || 0 })} /></div><div className="space-y-2"><label className="text-[10px] uppercase font-black text-brand-cyan tracking-widest ml-1">P. Venta ($)</label><input type="number" className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-brand-cyan focus:border-brand-cyan outline-none transition-all font-black text-xl" placeholder="0" value={formData.price_sell} onChange={(e) => setFormData({ ...formData, price_sell: parseFloat(e.target.value) || 0 })} /></div></div></div>
                  </div>
                  <div className="space-y-6">
                    {formData.type !== 'Servicio' && (<div className="space-y-4"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2"><Zap size={12} className="text-yellow-400" /> Distribución de Stock por Bodega</label><div className="grid grid-cols-1 gap-3">{WAREHOUSES.map(w => (<div key={w.id} className="flex items-center gap-4 bg-slate-950 p-3 rounded-2xl border border-white/5 group hover:border-brand-purple/50 transition-all"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${w.color}`}>{w.icon}</div><div className="flex-1"><p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">{w.label}</p></div><input type="number" className="w-20 bg-slate-900 border border-white/5 rounded-lg p-2 text-center text-white font-black outline-none focus:border-brand-purple" value={formData.stocksByWarehouse[w.id]} onChange={(e) => updateWarehouseStock(w.id, e.target.value)} /></div>))}</div></div>)}
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2"><Smartphone size={12} /> Modelos Compatibles</label><div className="flex flex-wrap gap-2 mb-3">{formData.compatible_models.map((model, index) => (<span key={index} className="bg-brand-purple/20 text-brand-purple border border-brand-purple/30 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in">{model}<button type="button" onClick={() => removeCompatibleModel(model)} className="hover:text-white"><X size={12} /></button></span>))}</div><div className="relative"><input type="text" className="w-full bg-slate-950 border border-white/5 rounded-xl p-3 pl-10 text-white text-sm focus:border-brand-cyan outline-none" placeholder="Buscar equipo..." value={modelSearch} onChange={(e) => { setModelSearch(e.target.value); setShowModelOptions(true); }} onFocus={() => setShowModelOptions(true)} /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />{showModelOptions && modelSearch && (<div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 custom-scrollbar">{filteredEquips.length > 0 ? (filteredEquips.map(eq => (<div key={eq.id} onClick={() => addCompatibleModel(`${eq.brand} ${eq.model}`)} className="p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 text-sm text-white flex justify-between items-center"><span>{eq.brand} <strong>{eq.model}</strong></span><span className="text-[10px] text-slate-500 uppercase">{eq.type}</span></div>))) : (<div onClick={() => addCompatibleModel(modelSearch)} className="p-3 hover:bg-white/10 cursor-pointer text-sm text-brand-cyan font-bold">Agregar "{modelSearch}" como nuevo</div>)}</div>)}</div></div>
                  </div>
                </div>
                <div className="pt-6 border-t border-white/5 flex gap-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-950 text-slate-500 font-black uppercase tracking-widest rounded-2xl border border-white/5 hover:text-white transition-all">Cancelar</button><button type="submit" className="flex-[2] bg-brand-gradient text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-brand-purple/40 hover:scale-[1.02] active:scale-95 transition-all italic">{editingId ? 'Actualizar Ficha' : 'Registrar en Inventario'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR ORDEN DE COMPRA (ACTUALIZADO CON URL) */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-white/10 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-center p-8 pb-4 border-b border-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Nueva Orden de Compra</h2>
                        <p className="text-slate-500 text-xs">Reposición de Stock a Bodega Local</p>
                    </div>
                    <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
                </div>
                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto">
                    <div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Proveedor</label>
                                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white" placeholder="Ej: AliExpress..." value={newOrder.supplier} onChange={e => setNewOrder({...newOrder, supplier: e.target.value})} />
                            </div>
                            
                            {/* 🔥 NUEVO CAMPO: URL DE SEGUIMIENTO */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><LinkIcon size={10} /> Link de Seguimiento (URL)</label>
                                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs" placeholder="Ej: https://blue.cl/tracking/123..." value={newOrder.trackingUrl} onChange={e => setNewOrder({...newOrder, trackingUrl: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Hash size={10} /> Tracking Code</label>
                                    <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs font-mono" placeholder="Ej: LX123456CN..." value={newOrder.trackingCode} onChange={e => setNewOrder({...newOrder, trackingCode: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar size={10} /> Fecha Llegada (Est)</label>
                                    <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs" style={{colorScheme: 'dark'}} value={newOrder.estimatedDate} onChange={e => setNewOrder({...newOrder, estimatedDate: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Buscar Productos</label>
                        <div className="relative mb-4">
                            <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pl-10 text-white" placeholder="Escribe para buscar..." value={itemSelectorSearch} onChange={e => setItemSelectorSearch(e.target.value)} />
                            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                        </div>
                        <div className="space-y-2 h-48 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl p-2">
                            {itemsToBuy.map(item => (
                                <div key={item.id} onClick={() => handleAddItemToOrder(item)} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all">
                                    <div><p className="text-white font-bold text-sm">{item.name}</p><p className="text-[10px] text-slate-500">Stock Actual: {Object.values(item.stocksByWarehouse || {}).reduce((a,b)=>a+b,0)}</p></div><Plus size={16} className="text-brand-cyan" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-950 rounded-2xl p-6 border border-white/5 flex flex-col">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><ShoppingCart size={18} className="text-brand-cyan"/> Resumen de Orden</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                            {newOrder.items.length === 0 && <p className="text-center text-slate-600 text-sm italic py-10">Agrega productos...</p>}
                            {newOrder.items.map(item => (
                                <div key={item.id} className="bg-slate-900 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                    <div className="flex-1"><p className="text-white text-xs font-bold truncate max-w-[150px]">{item.name}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-slate-500">Cant:</span><input type="number" className="w-12 bg-black/30 text-center rounded border border-white/10 text-white text-xs" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', e.target.value)} /><span className="text-[10px] text-slate-500">Costo:</span><input type="number" className="w-16 bg-black/30 text-center rounded border border-white/10 text-white text-xs" value={item.purchase_cost} onChange={(e) => updateOrderItem(item.id, 'purchase_cost', e.target.value)} /></div></div>
                                    <div className="text-right"><p className="text-brand-cyan font-bold text-sm">${(item.quantity * item.purchase_cost).toLocaleString()}</p><button onClick={() => removeOrderItem(item.id)} className="text-red-500 text-[10px] hover:underline">Quitar</button></div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/10 pt-4 flex justify-between items-center mb-4"><span className="text-slate-400 font-bold uppercase text-xs">Total Estimado</span><span className="text-2xl font-black text-white italic">${newOrder.items.reduce((acc, i) => acc + (i.quantity * i.purchase_cost), 0).toLocaleString()}</span></div>
                        <button onClick={submitOrder} className="w-full bg-brand-gradient text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-brand-purple/20 hover:scale-[1.02] transition-all">Generar Orden</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><AlertTriangle size={32} /></div>
            <h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar del Sistema?</h2>
            <p className="text-slate-400 mb-8 text-xs font-medium px-4">Estás a punto de borrar permanentemente <span className="text-white font-bold italic">"{itemToDelete?.name}"</span>.</p>
            <div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest">No, Volver</button><button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic">Sí, Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}