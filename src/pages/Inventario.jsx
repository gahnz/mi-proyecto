import { useState } from "react";
import { Plus, Search, AlertTriangle, Edit3, Trash2, X, Wrench, CheckSquare, Square, Home, Truck, Zap } from "lucide-react";
import { useInventory } from "../hooks/useInventory"; // 👈 Nuevo Hook
import { useEquipos } from "../hooks/useEquipos";     // 👈 Reutilizamos el de Equipos

const WAREHOUSES = [
  { id: "Bodega Local", label: "Bodega Local", icon: <Home size={14} />, color: "bg-slate-800 text-slate-300" },
  { id: "Mercado Libre", label: "Mercado Libre", icon: <Truck size={14} />, color: "bg-blue-500 text-white" },
  { id: "Mercado Full", label: "Mercado Full", icon: <Zap size={14} />, color: "bg-yellow-400 text-black" }
];

export default function Inventario() {
  // 1. GESTIÓN DE ESTADO CON HOOKS (Adiós LocalStorage manual)
  const { inventory: items, loading, addItem, updateItem, deleteItem } = useInventory();
  const { equipments: availableEquipments } = useEquipos(); // Cargamos equipos reales

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const initialStocks = {
    "Bodega Local": 0,
    "Mercado Libre": 0,
    "Mercado Full": 0
  };

  const [formData, setFormData] = useState({
    type: "Repuesto",
    name: "",
    sku: "",
    price_sell: 0,
    price_cost: 0,
    stocksByWarehouse: { ...initialStocks },
    min_stock: 5,
    compatible_models: []
  });

  // --- ACTIONS ---

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      type: item.type,
      name: item.name,
      sku: item.sku || "",
      price_sell: item.price_sell,
      price_cost: item.price_cost || 0,
      stocksByWarehouse: item.stocksByWarehouse || { ...initialStocks },
      min_stock: item.min_stock,
      compatible_models: item.compatible_models || []
    });
    setIsModalOpen(true);
  };

  const confirmDelete = (item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteItem(itemToDelete.id);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateItem(editingId, formData);
      } else {
        await addItem(formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      type: "Repuesto",
      name: "",
      sku: "",
      price_sell: 0,
      price_cost: 0,
      stocksByWarehouse: { ...initialStocks },
      min_stock: 5,
      compatible_models: []
    });
    setEditingId(null);
  };

  const toggleCompatibleModel = (modelName) => {
    const current = formData.compatible_models;
    if (current.includes(modelName)) {
      setFormData({ ...formData, compatible_models: current.filter(m => m !== modelName) });
    } else {
      setFormData({ ...formData, compatible_models: [...current, modelName] });
    }
  };

  const updateWarehouseStock = (warehouseId, value) => {
    setFormData(prev => ({
      ...prev,
      stocksByWarehouse: {
        ...prev.stocksByWarehouse,
        [warehouseId]: parseInt(value) || 0
      }
    }));
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Control de Inventario</h1>
          <p className="text-slate-400 font-medium">Gestión multi-bodega centralizada.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-brand-gradient hover:opacity-90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-purple/30"
        >
          <Plus size={20} /> Nuevo Ítem
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-slate-900/50 p-4 rounded-2x border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {loading && <span className="text-xs text-brand-purple animate-pulse font-bold uppercase">Sincronizando...</span>}
      </div>

      {/* TABLE */}
      <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
              <th className="px-6 py-4">Ítem / Info</th>
              <th className="px-6 py-4">Distribución de Stock</th>
              <th className="px-6 py-4 text-center">Total</th>
              <th className="px-6 py-4 text-right">Precio Venta</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredItems.map((item) => {
              const totalStock = Object.values(item.stocksByWarehouse || {}).reduce((a, b) => a + b, 0);
              return (
                <tr key={item.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white uppercase text-sm tracking-tight">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase font-black tracking-widest">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tracking-tighter">SKU: {item.sku || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {item.type === 'Servicio' ? (
                        <span className="text-brand-purple text-[10px] font-black uppercase tracking-widest bg-brand-purple/10 px-3 py-1 rounded-lg border border-brand-purple/20">
                          Servicio Intangible
                        </span>
                      ) : (
                        <>
                          {WAREHOUSES.map(w => {
                            const stock = item.stocksByWarehouse?.[w.id] || 0;
                            if (stock === 0) return null;
                            return (
                              <div key={w.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-white/5 ${w.color}`}>
                                {w.icon}
                                <span className="text-[10px] font-black uppercase tracking-tighter">{stock}</span>
                              </div>
                            );
                          })}
                          {(!item.stocksByWarehouse || Object.values(item.stocksByWarehouse).every(s => s === 0)) && (
                            <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Sin stock físico</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.type === 'Servicio' ? (
                      <span className="text-slate-600 text-sm font-bold uppercase tracking-widest">—</span>
                    ) : (
                      <span className={`text-lg font-black italic tracking-tighter ${totalStock <= item.min_stock ? "text-rose-500" : "text-brand-cyan"}`}>
                        {totalStock}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-black italic text-lg tracking-tighter shadow-sm">
                    ${(item.price_sell || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2 truncate">
                      <button onClick={() => handleEdit(item)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all">
                        <Edit3 size={18} />
                      </button>
                      <button onClick={() => confirmDelete(item)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-20 flex flex-col items-center">
            <Search size={48} className="text-slate-800 mb-4" />
            <p className="text-slate-500 font-black uppercase tracking-widest">No hay items en la base de datos</p>
          </div>
        )}
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border-t-brand-purple border-t-4 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">

            <div className="flex justify-between items-center p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-lg">
                  <Wrench size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                    {editingId ? 'Editar Ítem' : 'Nuevo Registro'}
                  </h2>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Gestión Centralizada Pro v2</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-800 hover:bg-white hover:text-slate-900 transition-all text-slate-400 p-2 rounded-xl">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 pt-4 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* LEFT: BASIC INFO */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Clasificación</label>
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                        {["Repuesto", "Servicio", "Consumible"].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: t })}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${formData.type === t ? 'bg-brand-gradient text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Nombre Comercial</label>
                      <input
                        required
                        className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-bold"
                        placeholder="Ej: Pantalla iPhone 13 OLED"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 font-mono">SKU / ID Interno</label>
                        <input
                          className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-mono text-sm"
                          placeholder="Ej: PANT-IP13-001"
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Stock Mínimo (Alerta)</label>
                        <input
                          type="number"
                          className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all font-bold"
                          value={formData.min_stock}
                          onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950 p-6 rounded-3xl border border-white/5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Costo ($)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-white focus:border-brand-purple outline-none transition-all text-sm"
                            placeholder="0"
                            value={formData.price_cost}
                            onChange={(e) => setFormData({ ...formData, price_cost: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black text-brand-cyan tracking-widest ml-1">P. Venta ($)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-brand-cyan focus:border-brand-cyan outline-none transition-all font-black text-xl"
                            placeholder="0"
                            value={formData.price_sell}
                            onChange={(e) => setFormData({ ...formData, price_sell: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: STOCK DISTRIBUTION & COMPATIBILITY */}
                  <div className="space-y-6">
                    {formData.type !== 'Servicio' && (
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                          <Zap size={12} className="text-yellow-400" /> Distribución de Stock por Bodega
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                          {WAREHOUSES.map(w => (
                            <div key={w.id} className="flex items-center gap-4 bg-slate-950 p-3 rounded-2xl border border-white/5 group hover:border-brand-purple/50 transition-all">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${w.color}`}>
                                {w.icon}
                              </div>
                              <div className="flex-1">
                                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">{w.label}</p>
                              </div>
                              <input
                                type="number"
                                className="w-20 bg-slate-900 border border-white/5 rounded-lg p-2 text-center text-white font-black outline-none focus:border-brand-purple"
                                value={formData.stocksByWarehouse[w.id]}
                                onChange={(e) => updateWarehouseStock(w.id, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                        <Wrench size={12} /> Modelos Compatibles (De BD Real)
                      </label>
                      <div className="bg-slate-950 border border-white/5 rounded-3xl p-4 h-[220px] overflow-y-auto space-y-2 custom-scrollbar">
                        {availableEquipments.length === 0 && <p className="text-slate-500 text-sm text-center py-4 italic">No hay equipos registrados aún...</p>}

                        {availableEquipments.map(equip => {
                          const fullName = `${equip.brand} ${equip.model}`;
                          const isSelected = formData.compatible_models.includes(fullName);
                          return (
                            <div
                              key={equip.id}
                              onClick={() => toggleCompatibleModel(fullName)}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isSelected
                                ? "bg-brand-purple/20 border-brand-purple/50"
                                : "bg-slate-900 border-white/5 hover:bg-slate-800"
                                }`}
                            >
                              <div className={isSelected ? "text-brand-purple" : "text-slate-700"}>
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white leading-tight underline decoration-white/0 group-hover:decoration-white/20 transition-all">{fullName}</div>
                                <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{equip.type}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-950 text-slate-500 font-black uppercase tracking-widest rounded-2xl border border-white/5 hover:text-white transition-all">Cancelar</button>
                  <button
                    type="submit"
                    className="flex-[2] bg-brand-gradient text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-brand-purple/40 hover:scale-[1.02] active:scale-95 transition-all italic"
                  >
                    {editingId ? 'Actualizar Ficha Técnica' : 'Registrar en Inventario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE MODAL --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar del Sistema?</h2>
            <p className="text-slate-400 mb-8 text-xs font-medium px-4">
              Estás a punto de borrar permanentemente <span className="text-white font-bold italic">"{itemToDelete?.name}"</span> y todos sus registros de stock asociados.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest"
              >
                No, Volver
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
}