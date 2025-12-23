import { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, AlertTriangle, Edit3, Trash2, X, Wrench, 
    Home, Truck, Zap, Smartphone, ShoppingCart, PackageCheck, 
    ClipboardList, Calendar, Hash, Clock, PackagePlus, DollarSign,
    CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Link as LinkIcon,
    Copy, ListChecks, FileSpreadsheet, Download, Receipt
} from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "sonner"; 
import { supabase } from "../supabase/client"; 
import { useInventory } from "../hooks/useInventory";
import { useEquipos } from "../hooks/useEquipos";
import { WAREHOUSES } from "../constants";


export default function Inventario() {
  const { inventory: items, loading, addItem, updateItem, deleteItem, refreshInventory, createBulkItems } = useInventory();
  const { equipments: availableEquipments } = useEquipos();

  const [activeTab, setActiveTab] = useState("inventory"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);

  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  
  const [modelSearch, setModelSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [itemSelectorSearch, setItemSelectorSearch] = useState("");

  const initialStocks = { "Bodega Local": 0, "Mercado Libre": 0, "Mercado Full": 0 };

  const [formData, setFormData] = useState({
    type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0,
    stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: []
  });

  const [newOrder, setNewOrder] = useState({ 
      supplier: "", 
      trackingCode: "", 
      trackingUrl: "", 
      estimatedDate: "", 
      items: [],
      paymentMethod: "Banco de Chile", // Valor por defecto
      category: "MERCADERIA"
  });
  
  // Estado para la recepción (si se usa en el futuro para editar recepción)
  const [receptionData, setReceptionData] = useState({
      orderId: null,
      order: null,
      paymentMethod: "Banco de Chile",
      category: "MERCADERIA",
      description: "",
      total: 0
  });

  // --- LÓGICA EXCEL ---
  const handleDownloadTemplate = () => {
    const template = [{ NOMBRE: "Pantalla iPhone 13 OLED", TIPO: "Repuesto", SKU: "PANT-IP13-001", PRECIO_VENTA: 85000, COSTO: 35000, STOCK_MINIMO: 5, BODEGA_LOCAL: 10, MERCADO_LIBRE: 0, MERCADO_FULL: 0, COMPATIBILIDAD: "iPhone 13, iPhone 13 Pro" }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Inventario.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) return toast.error("El archivo está vacío");
        const formattedItems = data.map(row => ({
          name: row.NOMBRE || "Sin nombre", type: row.TIPO || "Repuesto", sku: row.SKU || "", price_sell: Number(row.PRECIO_VENTA) || 0, price_cost: Number(row.COSTO) || 0, min_stock: Number(row.STOCK_MINIMO) || 5,
          stocks_by_warehouse: { "Bodega Local": Number(row.BODEGA_LOCAL) || 0, "Mercado Libre": Number(row.MERCADO_LIBRE) || 0, "Mercado Full": Number(row.MERCADO_FULL) || 0 },
          compatible_models: row.COMPATIBILIDAD ? row.COMPATIBILIDAD.split(',').map(m => m.trim()) : []
        }));
        toast.promise(createBulkItems(formattedItems), { loading: 'Procesando carga...', success: '¡Inventario actualizado!', error: 'Error al importar' });
        e.target.value = null; 
      } catch (err) { console.error(err); toast.error("Error al leer Excel"); }
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    const { data } = await supabase.from('supply_orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const incomingItemIds = useMemo(() => {
      const ids = new Set();
      orders.filter(o => o.status === 'Pendiente').forEach(order => { if (Array.isArray(order.items)) order.items.forEach(item => ids.add(item.id)); });
      return ids;
  }, [orders]);

  const handleSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-brand-purple" /> : <ArrowDown size={12} className="text-brand-purple" />;
  };

  const filteredEquips = availableEquipments.filter(eq => {
      const searchString = `${eq.brand} ${eq.model} ${eq.type}`.toLowerCase();
      return searchString.includes(modelSearch.toLowerCase());
  });

  const toggleCompatibleModel = (modelName) => {
      const currentModels = formData.compatible_models;
      if (currentModels.includes(modelName)) setFormData({ ...formData, compatible_models: currentModels.filter(m => m !== modelName) });
      else setFormData({ ...formData, compatible_models: [...currentModels, modelName] });
  };

  const handleSelectAllVisible = () => {
      const visibleModelNames = filteredEquips.map(eq => `${eq.brand} ${eq.model}`);
      const allSelected = visibleModelNames.every(name => formData.compatible_models.includes(name));
      if (allSelected) setFormData({ ...formData, compatible_models: formData.compatible_models.filter(m => !visibleModelNames.includes(m)) });
      else setFormData({ ...formData, compatible_models: Array.from(new Set([...formData.compatible_models, ...visibleModelNames])) });
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({ type: item.type, name: item.name, sku: item.sku || "", price_sell: item.price_sell, price_cost: item.price_cost || 0, stocksByWarehouse: item.stocksByWarehouse || { ...initialStocks }, min_stock: item.min_stock, compatible_models: item.compatible_models || [] });
    setIsModalOpen(true);
  };

  const handleDuplicate = (item) => {
      setEditingId(null); 
      setFormData({ type: item.type, name: `${item.name} (Copia)`, sku: "", price_sell: item.price_sell, price_cost: item.price_cost || 0, stocksByWarehouse: { ...initialStocks }, min_stock: item.min_stock, compatible_models: [...(item.compatible_models || [])] });
      setIsModalOpen(true);
      toast.info("Ítem duplicado. Revisa nombre y SKU.");
  };

  const confirmDelete = (item) => { setItemToDelete(item); setIsDeleteModalOpen(true); };
  const handleDelete = async () => { if (!itemToDelete) return; await deleteItem(itemToDelete.id); setIsDeleteModalOpen(false); setItemToDelete(null); toast.success("Ítem eliminado"); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const promise = editingId ? updateItem(editingId, formData) : addItem(formData);
    toast.promise(promise, { loading: 'Guardando...', success: 'Guardado correctamente', error: 'Error al guardar' });
    try { await promise; setIsModalOpen(false); setEditingId(null); resetForm(); } catch (error) { console.error(error); }
  };

  const resetForm = () => { setFormData({ type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0, stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: [] }); setEditingId(null); setModelSearch(""); };
  const updateWarehouseStock = (warehouseId, value) => { setFormData(prev => ({ ...prev, stocksByWarehouse: { ...prev.stocksByWarehouse, [warehouseId]: parseInt(value) || 0 } })); };

  const openEditOrderModal = (order) => {
      setEditingOrderId(order.id);
      setNewOrder({
          supplier: order.supplier_name, trackingCode: order.tracking_code || "", trackingUrl: order.tracking_url || "", estimatedDate: order.estimated_delivery_date || "", items: order.items || [],
          paymentMethod: "Banco de Chile", category: "MERCADERIA" 
      });
      setIsOrderModalOpen(true);
  };

  const handleDeletePurchase = async (e, orderId) => {
      e.stopPropagation();
      if(!window.confirm("⚠️ ¿Eliminar orden de compra?")) return;
      const { error } = await supabase.from('supply_orders').delete().eq('id', orderId);
      if (error) { toast.error("Error al eliminar"); } else { toast.success("Orden eliminada"); fetchOrders(); }
  };

  const handleAddItemToOrder = (item) => {
    const existing = newOrder.items.find(i => i.id === item.id);
    if (existing) return;
    setNewOrder({ ...newOrder, items: [...newOrder.items, { ...item, quantity: 1, purchase_cost: item.price_cost || 0 }] });
    setItemSelectorSearch(""); 
  };

  const updateOrderItem = (id, field, value) => { setNewOrder({ ...newOrder, items: newOrder.items.map(i => i.id === id ? { ...i, [field]: Number(value) } : i) }); };
  const removeOrderItem = (id) => { setNewOrder({ ...newOrder, items: newOrder.items.filter(i => i.id !== id) }); };

  // 🔥 CREACIÓN DE ORDEN + REGISTRO AUTOMÁTICO EN CAJA (CON COSTOS CORRECTOS)
  const submitOrder = async () => {
    if (!newOrder.supplier || newOrder.items.length === 0) { toast.error("Falta proveedor o items"); return; }
    const total = newOrder.items.reduce((acc, i) => acc + (i.quantity * i.purchase_cost), 0);
    
    // 1. Crear Payload de Orden
    const payload = { 
        supplier_name: newOrder.supplier, 
        items: newOrder.items, 
        total_cost: total, 
        tracking_code: newOrder.trackingCode, 
        tracking_url: newOrder.trackingUrl, 
        estimated_delivery_date: newOrder.estimatedDate || null 
    };
    if (!editingOrderId) payload.status = 'Pendiente';

    // 2. Guardar en Base de Datos (Orden)
    let orderResult;
    if (editingOrderId) { 
        orderResult = await supabase.from('supply_orders').update(payload).eq('id', editingOrderId).select().single(); 
    } else { 
        orderResult = await supabase.from('supply_orders').insert([payload]).select().single(); 
    }

    const { data: savedOrder, error: orderError } = orderResult;

    if (orderError) { 
        toast.error("Error al guardar orden"); 
        console.error(orderError);
        return;
    }

    // 3. 🔥 REGISTRAR GASTO EN CAJA (SOLO SI ES NUEVA)
    if (!editingOrderId) {
        const dateNow = new Date().toISOString().split('T')[0];
        
        // 👇 MAPEO CLAVE: Forzamos que 'price' sea el costo de compra
        const itemsForCashFlow = newOrder.items.map(item => ({
            ...item,
            price: item.purchase_cost // Así Flujo de Caja mostrará el costo, no el precio de venta
        }));

        const cashFlowEntry = {
            date: dateNow,
            type: 'expense',
            category: newOrder.category, 
            description: `Compra Inventario #${savedOrder.id} | Prov: ${newOrder.supplier}`,
            payment_method: newOrder.paymentMethod, 
            total_amount: total,
            net_amount: Math.round(total / 1.19),
            tax_amount: total - Math.round(total / 1.19),
            status: 'confirmed',
            is_ecommerce: false,
            items: itemsForCashFlow // 👈 Usamos la lista con precios corregidos
        };

        const { error: cashError } = await supabase.from('cash_flow').insert([cashFlowEntry]);
        if (cashError) {
            console.error("Error registrando gasto:", cashError);
            toast.warning("Orden creada, pero hubo error al registrar en caja.");
        } else {
            toast.success("✅ Orden creada y Gasto registrado en Caja");
        }
    } else {
        toast.success("Orden actualizada");
    }

    setIsOrderModalOpen(false); 
    setNewOrder({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [], paymentMethod: "Banco de Chile", category: "MERCADERIA" }); 
    setEditingOrderId(null); 
    fetchOrders();
  };

  // 🔥 RECEPCIÓN SIMPLIFICADA (SOLO STOCK)
  const handleReceiveOrder = async (e, order) => {
    e.stopPropagation();
    if (!window.confirm("¿Confirmar recepción de mercadería?\n\n(El gasto ya fue registrado al crear la orden)")) return;

    try {
        // A. Actualizar Stock
        const promises = (order.items || []).map(async (item) => {
            const { data: currentData } = await supabase.from('inventory').select('stocks_by_warehouse').eq('id', item.id).single();
            if (currentData) {
                const currentStock = currentData.stocks_by_warehouse?.["Bodega Local"] || 0;
                const newStock = currentStock + (Number(item.quantity) || 0);
                const newStocksJson = { ...currentData.stocks_by_warehouse, "Bodega Local": newStock };
                await supabase.from('inventory').update({ stocks_by_warehouse: newStocksJson }).eq('id', item.id);
            }
        });
        await Promise.all(promises);

        // B. Cerrar Orden (Sin tocar caja)
        await supabase.from('supply_orders').update({ status: 'Recibido', received_at: new Date().toISOString() }).eq('id', order.id);

        toast.success("✅ Stock ingresado correctamente"); 
        fetchOrders(); 
        refreshInventory();

    } catch (error) {
        console.error("Error recepción:", error);
        toast.error("Error al procesar", { description: error.message });
    }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase())));
  
  const sortedItems = [...filteredItems].sort((a, b) => {
      if (sortConfig.key === 'name') { return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
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
        
        <div className="flex gap-2 items-center">
            {activeTab === 'inventory' && (
              <>
                <button onClick={handleDownloadTemplate} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-white/10 transition-all text-[10px] uppercase tracking-wider" title="Descargar Plantilla Excel"><Download size={16} /> Plantilla</button>
                <div className="relative">
                  <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-[10px] uppercase tracking-wider"><FileSpreadsheet size={16} /> Importar Excel</button>
                </div>
              </>
            )}
            {activeTab === 'inventory' ? (
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-purple/30 text-xs ml-2"><Plus size={18} /> Nuevo Ítem</button>
            ) : (
                <button onClick={() => { setEditingOrderId(null); setNewOrder({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [], paymentMethod: "Banco de Chile", category: "MERCADERIA" }); setIsOrderModalOpen(true); }} className="bg-brand-cyan hover:bg-brand-cyan/80 text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-cyan/30 text-xs"><ShoppingCart size={18} /> Nueva Compra</button>
            )}
        </div>
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
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}><div className="flex items-center gap-2">Ítem / Info {getSortIcon('name')}</div></th>
                        <th className="px-6 py-4">Distribución de Stock</th>
                        <th className="px-6 py-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalStock')}><div className="flex items-center justify-center gap-2">Total {getSortIcon('totalStock')}</div></th>
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
                            <div className="font-bold text-white uppercase text-sm tracking-tight flex items-center gap-2">{item.name}{isIncoming && (<div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse" title="Hay una compra pendiente de recibir con este ítem"><PackagePlus size={12} /> EN CAMINO</div>)}</div>
                            <div className="flex items-center gap-2 mt-1"><span className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase font-black tracking-widest">{item.type}</span><span className="text-[10px] text-slate-500 font-mono tracking-tighter">SKU: {item.sku || 'N/A'}</span></div>
                        </td>
                        <td className="px-6 py-4"><div className="flex gap-2">{item.type === 'Servicio' ? (<span className="text-brand-purple text-[10px] font-black uppercase tracking-widest bg-brand-purple/10 px-3 py-1 rounded-lg border border-brand-purple/20">Servicio Intangible</span>) : (<>{WAREHOUSES.map(w => { const stock = item.stocksByWarehouse?.[w.id] || 0; if (stock === 0) return null; return (<div key={w.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-white/5 ${w.color}`}>{w.icon}<span className="text-[10px] font-black uppercase tracking-tighter">{stock}</span></div>); })} {(!item.stocksByWarehouse || Object.values(item.stocksByWarehouse).every(s => s === 0)) && (<span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Sin stock físico</span>)}</>)}</div></td>
                        <td className="px-6 py-4 text-center">{item.type === 'Servicio' ? <span className="text-slate-600 text-sm font-bold uppercase tracking-widest">—</span> : <span className={`text-lg font-black italic tracking-tighter ${totalStock <= item.min_stock ? "text-rose-500" : "text-brand-cyan"}`}>{totalStock}</span>}</td>
                        <td className="px-6 py-4 text-right text-white font-black italic text-lg tracking-tighter shadow-sm">${(item.price_sell || 0).toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4">
                            <div className="flex justify-center gap-2 truncate">
                                <button onClick={() => handleDuplicate(item)} className="p-2 bg-white/5 hover:bg-brand-purple/20 rounded-xl text-slate-400 hover:text-brand-purple transition-all" title="Duplicar"><Copy size={18} /></button>
                                <button onClick={() => handleEdit(item)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all"><Edit3 size={18} /></button>
                                <button onClick={() => confirmDelete(item)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all"><Trash2 size={18} /></button>
                            </div>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
        </>
      )}

      {/* VISTA 2: COMPRAS */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center py-20 text-slate-500 italic">No hay órdenes de compra registradas.</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                    const isLate = order.estimated_delivery_date && new Date(order.estimated_delivery_date) < new Date() && order.status === 'Pendiente';
                    return (
                        <div key={order.id} onClick={() => openEditOrderModal(order)} className="bg-slate-900 border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group hover:border-brand-purple/30 transition-all shadow-xl flex flex-col justify-between h-full cursor-pointer hover:bg-slate-800/50">
                            {order.status === 'Recibido' && <div className="absolute right-0 top-0 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-emerald-500/20">Recibido</div>}
                            {order.status === 'Pendiente' && <div className="absolute right-0 top-0 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-yellow-500/20 animate-pulse">Pendiente</div>}
                            <div>
                                <div className="mb-4 pr-16"><h3 className="text-lg font-black text-white italic leading-tight truncate">{order.supplier_name}</h3><p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-bold"><Calendar size={10} /> {new Date(order.created_at).toLocaleDateString()}</p></div>
                                {(order.estimated_delivery_date || order.tracking_code) && (<div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">{order.estimated_delivery_date && (<p className={`text-[10px] flex items-center gap-2 font-bold mb-1 ${isLate ? 'text-red-400' : 'text-brand-cyan'}`}><Clock size={12} /> Llegada: {new Date(order.estimated_delivery_date).toLocaleDateString()}</p>)}{order.tracking_code && (<div className="flex items-center justify-between"><p className="text-[10px] text-slate-300 flex items-center gap-2 font-mono"><Hash size={12} /> {order.tracking_code}</p>{order.tracking_url && (<a href={order.tracking_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] text-brand-purple hover:text-white flex items-center gap-1 font-bold uppercase hover:underline"><ExternalLink size={10} /> Seguir</a>)}</div>)}</div>)}
                                <div className="bg-black/20 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto custom-scrollbar border border-white/5"><div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-1"><ClipboardList size={10} /> {order.items.length} Items</div><div className="space-y-1.5">{order.items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs text-slate-300 border-b border-white/5 last:border-0 pb-1 last:pb-0"><span className="truncate pr-2">{item.quantity}x <strong className="text-white">{item.name}</strong></span></div>))}</div></div>
                            </div>
                            <div className="pt-2 border-t border-white/10 mt-auto"><div className="flex justify-between items-end mb-3"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Orden</span><span className="text-xl font-black text-white italic tracking-tighter flex items-center"><DollarSign size={14} className="text-slate-500 mr-0.5" />{order.total_cost.toLocaleString('es-CL')}</span></div><div className="flex gap-2"><button onClick={(e) => handleDeletePurchase(e, order.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all" title="Eliminar Compra"><Trash2 size={16} /></button>{order.status === 'Pendiente' ? (<button onClick={(e) => handleReceiveOrder(e, order)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"><PackageCheck size={14} /> Recibir</button>) : (<div className="flex-1 bg-slate-800 text-slate-500 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 cursor-default opacity-50"><CheckSquare size={14} /> Finalizado</div>)}</div></div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* MODAL ORDEN DE COMPRA */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
                        {editingOrderId ? "Editar Orden" : "Nueva Orden de Compra"}
                    </h2>
                    <button onClick={() => setIsOrderModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Proveedor</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={newOrder.supplier} onChange={(e) => setNewOrder({...newOrder, supplier: e.target.value})} placeholder="Nombre Proveedor" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Est. Llegada</label>
                            <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={newOrder.estimatedDate} onChange={(e) => setNewOrder({...newOrder, estimatedDate: e.target.value})} />
                        </div>
                    </div>

                    {/* 🔥 NUEVOS CAMPOS DE PAGO */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-white/5">
                        <div>
                            <label className="text-[10px] font-bold text-brand-purple uppercase block mb-1 flex items-center gap-1"><DollarSign size={10}/> Medio de Pago</label>
                            <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-xs" value={newOrder.paymentMethod} onChange={(e) => setNewOrder({...newOrder, paymentMethod: e.target.value})}>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Banco de Chile">Banco de Chile</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Transferencia">Transferencia</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-brand-cyan uppercase block mb-1 flex items-center gap-1"><ListChecks size={10}/> Categoría Egreso</label>
                            <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-xs" value={newOrder.category} onChange={(e) => setNewOrder({...newOrder, category: e.target.value})}>
                                <option value="MERCADERIA">Mercadería / Repuestos</option>
                                <option value="HERRAMIENTAS">Herramientas e Insumos</option>
                                <option value="G_GENERAL">Gasto General</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Código Seguimiento</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={newOrder.trackingCode} onChange={(e) => setNewOrder({...newOrder, trackingCode: e.target.value})} placeholder="Ej: 123456789" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">URL Seguimiento</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={newOrder.trackingUrl} onChange={(e) => setNewOrder({...newOrder, trackingUrl: e.target.value})} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="relative bg-slate-950 p-4 rounded-xl border border-white/5">
                        <label className="text-[10px] font-bold text-brand-purple uppercase block mb-2 flex items-center gap-2"><Search size={12}/> Agregar Productos del Inventario</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-brand-cyan transition-all" placeholder="Buscar item para agregar..." value={itemSelectorSearch} onChange={(e) => setItemSelectorSearch(e.target.value)} />
                        {itemSelectorSearch && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl max-h-40 overflow-y-auto z-20 mx-4">
                                {itemsToBuy.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-500 text-center">No encontrado</div>
                                ) : itemsToBuy.map(item => (
                                    <div key={item.id} onClick={() => handleAddItemToOrder(item)} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 flex justify-between items-center transition-colors">
                                        <span className="text-sm text-white font-medium">{item.name}</span>
                                        <span className="text-xs text-brand-purple font-bold">${item.price_cost}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Items en la Orden ({newOrder.items.length})</label>
                        {newOrder.items.length === 0 ? (
                            <div className="text-center py-8 text-slate-600 border-2 border-dashed border-white/5 rounded-xl text-xs font-medium">No hay items agregados a la orden.</div>
                        ) : (
                            newOrder.items.map((item, idx) => (
                                <div key={idx} className="bg-slate-950/50 p-3 rounded-xl border border-white/5 flex items-center gap-3 hover:border-white/10 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{item.name}</div>
                                        <div className="text-[10px] text-slate-500">{item.sku || 'S/N'}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <label className="text-[8px] text-slate-500 block uppercase font-bold">Cant.</label>
                                            <input type="number" className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-white text-xs font-bold outline-none focus:border-brand-purple" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="text-[8px] text-slate-500 block uppercase font-bold">Costo Unit.</label>
                                            <input type="number" className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-right text-white text-xs font-mono outline-none focus:border-brand-purple" value={item.purchase_cost} onChange={(e) => updateOrderItem(item.id, 'purchase_cost', e.target.value)} />
                                        </div>
                                        <button onClick={() => removeOrderItem(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all mt-3"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900 flex justify-between items-center sticky bottom-0 z-10">
                    <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-widest">Total Estimado</span>
                        <span className="text-2xl font-black text-brand-cyan tracking-tighter">${newOrder.items.reduce((acc, i) => acc + (i.quantity * i.purchase_cost), 0).toLocaleString('es-CL')}</span>
                    </div>
                    <button onClick={submitOrder} className="bg-brand-gradient text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-brand-purple/20 hover:opacity-90 transition-all hover:scale-105 active:scale-95">Guardar Orden</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL CREAR ITEM (Mantenido igual) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-white/10 flex justify-between items-center"><h2 className="text-xl font-black text-white italic uppercase">{editingId ? "Editar Producto" : "Nuevo Producto"}</h2><button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5">{['Repuesto', 'Accesorio', 'Servicio'].map(t => (<button key={t} type="button" onClick={() => setFormData({...formData, type: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${formData.type === t ? 'bg-brand-gradient text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t}</button>))}</div>
                    <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre Item</label><input required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">SKU / Código</label><input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Stock Mínimo</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value)})} /></div></div>
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-white/5"><div><label className="text-[10px] font-bold text-brand-purple uppercase mb-1 block">Precio Costo</label><input type="number" className="w-full bg-slate-900 border border-brand-purple/30 rounded-xl p-3 text-white font-bold outline-none" value={formData.price_cost} onChange={(e) => setFormData({...formData, price_cost: parseInt(e.target.value)})} /></div><div><label className="text-[10px] font-bold text-brand-cyan uppercase mb-1 block">Precio Venta</label><input type="number" className="w-full bg-slate-900 border border-brand-cyan/30 rounded-xl p-3 text-white font-bold outline-none" value={formData.price_sell} onChange={(e) => setFormData({...formData, price_sell: parseInt(e.target.value)})} /></div></div>
                    {formData.type !== 'Servicio' && (<div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Distribución de Stock</label>{WAREHOUSES.map(w => (<div key={w.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5"><div className="flex items-center gap-2 text-xs font-bold text-slate-300">{w.icon} {w.label}</div><input type="number" className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-white text-xs font-mono" value={formData.stocksByWarehouse[w.id] || 0} onChange={(e) => updateWarehouseStock(w.id, e.target.value)} /></div>))}</div>)}
                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center">Compatibilidad <button type="button" onClick={handleSelectAllVisible} className="text-brand-purple hover:underline">Seleccionar visibles</button></label><input type="text" placeholder="Buscar modelo..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white mb-2" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} /><div className="max-h-32 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">{filteredEquips.map(eq => { const modelName = `${eq.brand} ${eq.model}`; const isSelected = formData.compatible_models.includes(modelName); return (<div key={eq.id} onClick={() => toggleCompatibleModel(modelName)} className={`p-2 rounded-lg text-[10px] font-bold cursor-pointer border transition-all ${isSelected ? 'bg-brand-purple/20 border-brand-purple text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}>{modelName}</div>)})}</div></div>
                    <button className="w-full bg-brand-gradient py-3 rounded-xl text-white font-black uppercase tracking-widest hover:opacity-90">Guardar Producto</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4"><div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300"><div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><AlertTriangle size={32} /></div><h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar Ítem?</h2><p className="text-slate-400 mb-8 text-xs font-medium px-4">Esta acción borrará <span className="text-white font-bold italic">"{itemToDelete?.name}"</span> permanentemente.</p><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest">Cancelar</button><button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic">Sí, Eliminar</button></div></div></div>
      )}

    </div>
  );
}