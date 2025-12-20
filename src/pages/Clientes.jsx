import { useEffect, useState } from "react";
import { Plus, Search, Edit3, Trash2, X, Phone, Mail, MapPin, Building2, Info, AlertTriangle } from "lucide-react";
import { storage } from "../services/storage";
import { supabase } from "../supabase/client";

// DATA COMPLETA DE COMUNAS RM Y REGIONES
const REGIONES_CHILE = {
  "Región Metropolitana": [
    "Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Ñuñoa", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante", "Tiltil", "Vitacura"
  ],
  "Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "Concón", "San Antonio", "Quillota", "Los Andes"],
  "Biobío": ["Concepción", "Talcahuano", "Coronel", "Hualpén", "Chiguayante", "San Pedro de la Paz", "Lota", "Tomé"],
};

const GIROS_EJEMPLO = ["Servicios Informáticos", "Venta de Equipos", "Asesorías Profesionales", "Comercio Minorista", "Construcción"];

export default function Clientes() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    type: "Persona", full_name: "", business_name: "", rut_dni: "",
    email: "", phone: "", address: "", region: "", comuna: "",
    giro: "", observations: ""
  });

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching customers:", error);
    } else {
      setCustomers(data || []);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación de seguridad para selectores (Obligatorios)
    if (!formData.region || !formData.comuna) {
      alert("La Región y Comuna son obligatorias.");
      return;
    }

    // Preparar datos: convertir strings vacíos de campos opcionales en NULL para evitar errores de duplicado
    const submissionData = {
      ...formData,
      rut_dni: formData.rut_dni?.trim() === "" ? null : formData.rut_dni,
      email: formData.email?.trim() === "" ? null : formData.email,
      giro: formData.giro?.trim() === "" ? null : formData.giro,
      observations: formData.observations?.trim() === "" ? null : formData.observations
    };

    if (editingId) {
      const { error } = await supabase
        .from("customers")
        .update(submissionData)
        .eq("id", editingId);

      if (error) {
        if (error.code === "23505") alert("Ese RUT ya está registrado con otro cliente.");
        else alert("Error al actualizar cliente: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("customers")
        .insert([submissionData]);

      if (error) {
        if (error.code === "23505") alert("Ese RUT ya está registrado con otro cliente.");
        else alert("Error al crear cliente: " + error.message);
        return;
      }
    }

    closeModal();
    fetchCustomers();
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) {
        alert("Error al eliminar cliente: " + error.message);
      } else {
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
        fetchCustomers();
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      type: "Persona", full_name: "", business_name: "", rut_dni: "",
      email: "", phone: "", address: "", region: "", comuna: "",
      giro: "", observations: ""
    });
  };

  const filtered = customers.filter(c =>
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.rut_dni?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tight uppercase">Base de Clientes</h1>
          <p className="text-slate-400 font-medium tracking-wide">Gestión de Particulares y Empresas de Técnico Computín.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-gradient hover:opacity-90 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-brand-purple/30 transition-all"
        >
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, empresa o rut..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-brand-cyan transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* LISTADO DE TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl hover:border-brand-purple/50 transition-all group relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 px-3 py-1 bg-white/5 text-[10px] font-bold text-slate-500 uppercase rounded-bl-xl border-l border-b border-white/5">
              {c.type}
            </div>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-xl ${c.type === 'Empresa' ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30' : 'bg-brand-gradient shadow-lg shadow-brand-purple/20'}`}>
                {c.type === 'Empresa' ? <Building2 size={24} /> : c.full_name[0]}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditingId(c.id); setFormData(c); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:text-brand-cyan transition-colors"><Edit3 size={18} /></button>
                <button onClick={() => { setItemToDelete(c); setIsDeleteModalOpen(true); }} className="p-2 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
              </div>
            </div>
            <h3 className="text-white font-bold text-lg leading-tight uppercase">{c.type === 'Empresa' ? c.business_name : c.full_name}</h3>
            {c.type === 'Empresa' && <p className="text-brand-cyan text-[10px] font-bold uppercase mt-1 tracking-widest">Contacto: {c.full_name}</p>}
            <p className="text-slate-500 text-sm mb-4 font-mono">{c.rut_dni || 'Sin RUT'}</p>
            <div className="space-y-2 text-sm text-slate-400 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2"><Phone size={14} className="text-brand-purple" /> {c.phone}</div>
              <div className="flex items-center gap-2"><Mail size={14} className="text-brand-purple" /> {c.email || '—'}</div>
              <div className="flex items-start gap-2"><MapPin size={14} className="text-brand-purple mt-1" /> <span>{c.address}, {c.comuna}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PRINCIPAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border-t-brand-cyan border-t-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight italic">
                {editingId ? 'Actualizar Cliente' : 'Nuevo Registro de Cliente'}
              </h2>
              <X className="text-slate-500 cursor-pointer hover:text-white" onClick={closeModal} />
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                {['Persona', 'Empresa'].map((t) => (
                  <button key={t} type="button" onClick={() => setFormData({ ...formData, type: t })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.type === t ? 'bg-brand-gradient text-white shadow-lg' : 'text-slate-500'}`}>
                    {t === 'Persona' ? '👤 Particular' : '🏢 Empresa'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.type === 'Empresa' ? (
                  <>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase font-bold text-brand-cyan ml-1 mb-1 block tracking-widest">Razón Social *</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none transition-all" placeholder="Nombre legal de la empresa" value={formData.business_name || ''} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Giro Comercial</label>
                      <input list="giros" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="Ej: Servicios Informáticos" value={formData.giro || ''} onChange={(e) => setFormData({ ...formData, giro: e.target.value })} />
                      <datalist id="giros">{GIROS_EJEMPLO.map(g => <option key={g} value={g} />)}</datalist>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Nombre Contacto / Jefe *</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="Persona encargada" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Nombre Completo *</label>
                    <input required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="Juan Pérez..." value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Teléfono Móvil *</label>
                  <input required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="+56 9 ..." value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest font-mono">RUT (Opcional)</label>
                  <input className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="12345678-9" value={formData.rut_dni} onChange={(e) => setFormData({ ...formData, rut_dni: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Correo Electrónico</label>
                  <input type="email" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="cliente@correo.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>

                {/* UBICACIÓN OBLIGATORIA */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Región *</label>
                  <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-brand-cyan cursor-pointer appearance-none" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value, comuna: "" })}>
                    <option value="">Seleccione Región...</option>
                    {Object.keys(REGIONES_CHILE).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Comuna *</label>
                  <select required disabled={!formData.region} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-brand-cyan disabled:opacity-30 cursor-pointer appearance-none" value={formData.comuna} onChange={(e) => setFormData({ ...formData, comuna: e.target.value })}>
                    <option value="">Seleccione Comuna...</option>
                    {formData.region && REGIONES_CHILE[formData.region].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest">Dirección Completa *</label>
                  <input required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-brand-cyan outline-none" placeholder="Calle, N°, Depto / Oficina..." value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 mb-1 block tracking-widest flex items-center gap-1"><Info size={12} /> Información Adicional</label>
                  <textarea rows="2" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-brand-cyan resize-none" placeholder="Notas sobre el cliente, horarios, deudas..." value={formData.observations} onChange={(e) => setFormData({ ...formData, observations: e.target.value })} />
                </div>
              </div>

              <button type="submit" className="w-full bg-brand-gradient text-white font-black uppercase py-4 rounded-xl shadow-lg shadow-brand-purple/40 hover:scale-[1.01] transition-all sticky bottom-0 z-10 tracking-widest italic">
                {editingId ? 'Confirmar Cambios' : 'Registrar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">¿Eliminar Cliente?</h2>
            <p className="text-slate-400 mb-8 text-sm">Esta acción borrará a <span className="text-white font-bold italic">"{itemToDelete?.type === 'Empresa' ? itemToDelete?.business_name : itemToDelete?.full_name}"</span> permanentemente del sistema.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-all uppercase text-xs">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all uppercase text-xs">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}