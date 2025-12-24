import { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, User, 
    Building2, History, X, Smartphone 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";
import { useCustomers } from "../hooks/useCustomers";
import { CHILE_DATA } from "../constants"; // Importamos la data geográfica

export default function Clientes() {
    const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
    
    // Estados básicos
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState(null);

    // Estados Historial (CRM) - Simplificado para el ejemplo
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Estado del Formulario
    const [formData, setFormData] = useState({
        type: "Particular",
        full_name: "",      // Nombre cliente o Persona de contacto en empresa
        business_name: "",  // Razón Social (Solo empresa)
        rut: "",            // RUT Personal o Empresa
        email: "",
        phone: "",
        region: "",
        comuna: "",
        address: "",        // Dirección calle/número
        additional_info: "" // Información adicional
    });

    // Lógica para filtrar comunas según región seleccionada
    const availableComunas = useMemo(() => {
        const regionData = CHILE_DATA.find(r => r.region === formData.region);
        return regionData ? regionData.comunas : [];
    }, [formData.region]);

    // --- LÓGICA CRUD ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validaciones manuales extra (aunque HTML 'required' ayuda)
        if (!formData.region || !formData.comuna) {
            return toast.error("Región y Comuna son obligatorias");
        }

        const promise = editingId ? updateCustomer(editingId, formData) : addCustomer(formData);
        toast.promise(promise, { loading: 'Guardando...', success: 'Guardado correctamente', error: 'Error al guardar' });
        try { await promise; setIsModalOpen(false); resetForm(); } catch (error) { console.error(error); }
    };

    const confirmDelete = (customer) => { setCustomerToDelete(customer); setIsDeleteModalOpen(true); };
    const handleDelete = async () => { if (!customerToDelete) return; await deleteCustomer(customerToDelete.id); setIsDeleteModalOpen(false); setCustomerToDelete(null); toast.success("Cliente eliminado"); };
    
    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setFormData({
            type: customer.type || "Particular",
            full_name: customer.full_name || "",
            business_name: customer.business_name || "",
            rut: customer.rut || "",
            email: customer.email || "",
            phone: customer.phone || "",
            region: customer.region || "",
            comuna: customer.comuna || "",
            address: customer.address || "",
            additional_info: customer.additional_info || ""
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ 
            type: "Particular", full_name: "", business_name: "", rut: "", 
            email: "", phone: "", region: "", comuna: "", address: "", additional_info: "" 
        });
        setEditingId(null);
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
                                {customer.type === 'Empresa' && <p className="text-xs text-slate-400">Contacto: {customer.full_name}</p>}
                                <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-white/5 mt-1 inline-block">{customer.rut || 'Sin RUT'}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400 mb-4">
                            {customer.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-600"/> {customer.phone}</div>}
                            {customer.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-600"/> <span className="truncate">{customer.email}</span></div>}
                            {(customer.region || customer.comuna) && <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-600"/> <span className="truncate">{customer.comuna}, {customer.region}</span></div>}
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL CREAR/EDITAR */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
                            <h2 className="text-xl font-black text-white italic uppercase">{editingId ? "Editar Cliente" : "Nuevo Cliente"}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Selector Tipo */}
                                <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-white/5">
                                    {['Particular', 'Empresa'].map(t => (
                                        <button key={t} type="button" onClick={() => setFormData({...formData, type: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${formData.type === t ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-white'}`}>{t}</button>
                                    ))}
                                </div>

                                {/* CAMPOS DE EMPRESA (Solo si es Empresa) */}
                                {formData.type === 'Empresa' && (
                                    <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 space-y-3">
                                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Datos de la Empresa</p>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Razón Social *</label>
                                            <input required className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.business_name} onChange={(e) => setFormData({...formData, business_name: e.target.value})} placeholder="Ej: Servicios Informáticos SpA" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">RUT Empresa (Opcional)</label>
                                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.rut} onChange={(e) => setFormData({...formData, rut: e.target.value})} placeholder="76.xxx.xxx-x" />
                                        </div>
                                    </div>
                                )}

                                {/* DATOS DE CONTACTO / PARTICULAR */}
                                <div className="space-y-3">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{formData.type === 'Empresa' ? 'Información de Contacto' : 'Datos Personales'}</p>
                                    
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nombre Completo *</label>
                                        <input required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder={formData.type === 'Empresa' ? "Nombre del contacto" : "Nombre del cliente"} />
                                    </div>

                                    {formData.type === 'Particular' && (
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">RUT (Opcional)</label>
                                            <input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.rut} onChange={(e) => setFormData({...formData, rut: e.target.value})} />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Teléfono *</label>
                                            <input required type="tel" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+569..." />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email (Opcional)</label>
                                            <input type="email" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" />
                                        </div>
                                    </div>
                                </div>

                                {/* UBICACIÓN (Obligatorios) */}
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ubicación</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Región *</label>
                                            <select required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-xs" value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value, comuna: ""})}>
                                                <option value="">Seleccione Región</option>
                                                {CHILE_DATA.map((r, i) => <option key={i} value={r.region}>{r.region}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Comuna *</label>
                                            <select required disabled={!formData.region} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-xs disabled:opacity-50" value={formData.comuna} onChange={(e) => setFormData({...formData, comuna: e.target.value})}>
                                                <option value="">Seleccione Comuna</option>
                                                {availableComunas.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dirección / Calle</label>
                                        <input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Ej: Av. Providencia 1234" />
                                    </div>
                                </div>

                                {/* INFORMACIÓN ADICIONAL */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Información Adicional</label>
                                    <textarea className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm h-20 resize-none" value={formData.additional_info} onChange={(e) => setFormData({...formData, additional_info: e.target.value})} placeholder="Datos extra, referencias, horarios..." />
                                </div>

                                <button className="w-full bg-brand-gradient py-3.5 rounded-xl text-white font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-brand-purple/20">Guardar Cliente</button>
                            </form>
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