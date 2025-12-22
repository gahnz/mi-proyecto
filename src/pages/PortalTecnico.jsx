import { useState, useEffect, useRef } from "react";
import SignatureCanvas from 'react-signature-canvas';
import { 
  ClipboardList, Search, LogOut, User, ChevronRight, Save, X, 
  Hash, Printer, PenTool, Camera, Image as ImageIcon, Loader2, FileText,
  RefreshCw, Eraser, MapPin, Phone, MessageCircle, PlayCircle, CheckCircle2,
  Send, Clock 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";
import { useNavigate } from "react-router-dom";
import { useWorkOrders } from "../hooks/useWorkOrders";
// import { generateOrderPDF } from "../utils/pdfGenerator"; // YA NO SE USA AQUÍ
import { getChileTime } from "../utils/time";
// 👇 IMPORTAMOS LA LIBRERÍA DE COMPRESIÓN
import imageCompression from 'browser-image-compression';

export default function PortalTecnico() {
  const navigate = useNavigate();
  const { orders, updateOrder, refresh } = useWorkOrders();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sigPad = useRef(null); 
  const [showSigPad, setShowSigPad] = useState(false);

  const [editForm, setEditForm] = useState({
    status: "", internalNotes: "", probReal: "", solReal: "", observations: "",
    serialNumber: "", pageCount: "", receiverName: "", receiverSignature: "",
    photoBefore: null, photoAfter: null
  });

  useEffect(() => {
    const getUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
        if (profile) setCurrentUser(profile);
      } catch (error) { console.error(error); } finally { setLoadingUser(false); }
    };
    getUserProfile();
  }, [navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
    toast.success("Lista actualizada");
  };

  const myOrders = orders.filter(order => {
    const techNameOrder = (order.technician || "").toLowerCase().trim();
    const techNameUser = (currentUser?.full_name || "").toLowerCase().trim();
    const isAssigned = currentUser?.role === 'admin' ? true : techNameOrder === techNameUser;
    
    const matchesSearch = 
        (order.customer || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.device || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.id || "").toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = ['En cola', 'Trabajando'].includes(order.status);
    return isAssigned && matchesSearch && isActive;
  });

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    const existingSignature = order.receiver_signature || "";
    setEditForm({
      status: order.status || "En cola",
      internalNotes: order.internal_notes || "", probReal: order.prob_real || "", solReal: order.sol_real || "",         
      observations: order.observations || "", serialNumber: order.serial_number || "", pageCount: order.page_count || "",       
      receiverName: order.receiver_name || "", receiverSignature: existingSignature, 
      photoBefore: order.photo_before || null, photoAfter: order.photo_after || null
    });
    setShowSigPad(!existingSignature);
  };

  const handleLlegueAuto = async (e, orderToUpdate) => {
    if(e) e.stopPropagation(); 
    const targetOrder = orderToUpdate || selectedOrder;
    if (!targetOrder) return;

    const updates = { status: "Trabajando", start_date: getChileTime() };
    const promise = updateOrder(targetOrder.db_id, updates);

    toast.promise(promise, {
        loading: '📍 Registrando llegada...',
        success: () => {
            if (selectedOrder && selectedOrder.id === targetOrder.id) {
                setEditForm(prev => ({ ...prev, status: 'Trabajando' }));
                setSelectedOrder(prev => ({ ...prev, status: 'Trabajando' }));
            }
            return '✅ ¡Estado actualizado a TRABAJANDO!';
        },
        error: '❌ Error al actualizar'
    });
  };

  // 🔥 FUNCIÓN DE SUBIDA DE IMAGEN OPTIMIZADA
  const handleImageUpload = async (event, field) => {
    const imageFile = event.target.files[0];
    if (!imageFile) return;

    setUploading(true);

    // Opciones de compresión
    const options = {
      maxSizeMB: 1,          // Máximo 1MB
      maxWidthOrHeight: 1920, // Máxima resolución Full HD
      useWebWorker: true,    // Usa un hilo separado para no congelar la app
      fileType: 'image/jpeg' // Asegura formato JPEG
    };

    try {
        toast.loading("Comprimiendo imagen...", { id: "upload-toast" });
        
        // 1. Comprimir la imagen
        const compressedFile = await imageCompression(imageFile, options);
        
        toast.loading("Subiendo a la nube...", { id: "upload-toast" });

        // 2. Preparar nombre de archivo y ruta
        const fileExt = 'jpg'; // Siempre será jpg por la compresión
        const fileName = `${selectedOrder.id}_${field}_${Date.now()}.${fileExt}`;
        const filePath = `evidencia/${fileName}`; // Guardar en subcarpeta 'evidencia'

        // 3. Subir a Supabase
        const { error: uploadError } = await supabase.storage
            .from('repair-images')
            .upload(filePath, compressedFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('repair-images')
            .getPublicUrl(filePath);

        // 5. Actualizar formulario
        setEditForm(prev => ({ ...prev, [field]: publicUrl }));
        
        toast.success("Imagen optimizada y guardada exitosamente", { id: "upload-toast" });

    } catch (error) {
        console.error("Error en proceso de imagen:", error);
        toast.error("Error al procesar la imagen: " + error.message, { id: "upload-toast" });
    } finally {
        setUploading(false);
    }
  };

  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], {type:mime});
  }

  const handleSaveUpdate = async (forceStatus = null) => {
    if (!selectedOrder) return;
    let finalSignatureUrl = editForm.receiverSignature;

    if (showSigPad && sigPad.current && !sigPad.current.isEmpty()) {
        try {
            const signatureDataUrl = sigPad.current.getCanvas().toDataURL('image/png');
            const signatureBlob = dataURLtoBlob(signatureDataUrl);
            const fileName = `firmas/${selectedOrder.id}_signature_${Date.now()}.png`; // Guardar en subcarpeta 'firmas'
            const { error: uploadError } = await supabase.storage.from('repair-images').upload(fileName, signatureBlob);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('repair-images').getPublicUrl(fileName);
            finalSignatureUrl = publicUrl;
        } catch (error) { console.error(error); toast.error("Error al guardar la firma"); return; }
    }

    const statusToSave = forceStatus || editForm.status;
    const payload = {
        status: statusToSave, internal_notes: editForm.internalNotes, prob_real: editForm.probReal,
        sol_real: editForm.solReal, observations: editForm.observations, serial_number: editForm.serialNumber,
        page_count: editForm.pageCount, receiver_name: editForm.receiverName, receiver_signature: finalSignatureUrl,
        photo_before: editForm.photoBefore, photo_after: editForm.photoAfter,
        ...(forceStatus === 'Revisión del Coordinador' ? { estimated_end_date: getChileTime() } : {})
    };

    const promise = updateOrder(selectedOrder.db_id, payload);
    const successMessage = forceStatus ? '¡Informe enviado a revisión!' : '¡Avance guardado correctamente!';

    toast.promise(promise, {
        loading: 'Procesando...',
        success: () => { setSelectedOrder(null); refresh(); return successMessage; },
        error: (err) => `Error: ${err.message}`
    });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  const getStatusColor = (status) => {
    if (status === 'En cola') return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    if (status === 'Trabajando') return 'text-brand-purple bg-brand-purple/10 border-brand-purple/20';
    return 'text-slate-400 bg-slate-800 border-white/5';
  };

  const clearSignature = () => { if(sigPad.current) sigPad.current.clear(); };
  const cleanPhone = (phone) => { if(!phone) return ""; return phone.replace(/[^0-9]/g, ''); };

  if (loadingUser) return <div className="h-screen flex items-center justify-center text-slate-500 animate-pulse">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* HEADER */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/10 p-4 sticky top-0 z-20 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-black text-white italic uppercase tracking-tighter">Portal Técnico</h1>
            <p className="text-[10px] text-brand-purple font-bold uppercase tracking-widest flex items-center gap-1"><User size={10} /> {currentUser?.full_name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRefresh} className={`p-2 bg-slate-800 rounded-full text-brand-cyan hover:bg-brand-cyan/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={18} /></button>
            <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-red-500/20 transition-all"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input type="text" placeholder="Buscar orden..." className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm outline-none focus:border-brand-purple transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* LISTA DE TRABAJOS */}
      <div className="p-4 space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Mis Asignaciones ({myOrders.length})</h2>
        
        {myOrders.length === 0 ? ( 
            <div className="text-center py-20 text-slate-300 text-sm font-medium">No tienes órdenes activas.<br/>¡Buen trabajo! 🎉</div> 
        ) : (
            myOrders.map(order => (
            <div key={order.db_id} onClick={() => openOrderModal(order)} className="bg-slate-900 border border-white/5 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer hover:border-brand-purple/30 shadow-lg relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${order.status === 'Trabajando' ? 'bg-brand-purple animate-pulse shadow-[0_0_10px_#a855f7]' : 'bg-slate-700'}`}></div>
                
                <div className="flex justify-between items-start mb-2 pl-3">
                    <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2 py-1 rounded-md border border-white/5 tracking-wider">{order.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${getStatusColor(order.status)} uppercase tracking-wide`}>{order.status}</span>
                </div>
                
                <div className="pl-3 pr-2">
                    <h3 className="text-white font-bold text-lg leading-tight mb-1">{order.device}</h3>
                    
                    <div className="flex items-start gap-2 mb-3 text-slate-300">
                        <MapPin size={16} className="text-rose-400 mt-0.5 shrink-0" />
                        <div className="leading-tight">
                            <span className="text-xs block font-medium">{order.customer_address || "Sin dirección"}</span>
                            {order.customer_commune && (
                                <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest mt-0.5 block">
                                    {order.customer_commune}
                                </span>
                            )}
                        </div>
                    </div>

                    <p className="text-slate-400 text-xs line-clamp-2 mb-3 bg-white/5 p-2 rounded-lg italic border border-white/5">"{order.problem}"</p>
                    
                    <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                        {order.status === 'En cola' ? (
                            <button 
                                onClick={(e) => handleLlegueAuto(e, order)}
                                className="bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 hover:bg-brand-cyan hover:text-black px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-cyan/10 hover:scale-105 active:scale-95"
                            >
                                <MapPin size={14} /> LLEGUÉ
                            </button>
                        ) : (
                            <div className="text-xs text-brand-purple font-bold flex items-center gap-1 animate-pulse bg-brand-purple/10 px-3 py-1 rounded-full border border-brand-purple/20">
                                <Clock size={14} /> TRABAJANDO...
                            </div>
                        )}

                        <div className="flex gap-2">
                            <div className="p-2 bg-slate-800 rounded-full text-slate-600"><ChevronRight size={16} /></div>
                        </div>
                    </div>
                </div>
            </div>
            ))
        )}
      </div>

      {/* MODAL DETALLE */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full md:w-[500px] bg-slate-900 h-full border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-900">
              <div><h2 className="text-lg font-black text-white italic uppercase tracking-tighter">{selectedOrder.id}</h2><p className="text-xs text-slate-400">{selectedOrder.device}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              
              {/* DATOS DEL CLIENTE EN MODAL */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3">
                 <label className="text-[10px] font-black text-brand-purple uppercase tracking-widest mb-1 flex items-center gap-2">
                    <User size={12} /> Cliente
                 </label>
                 <div>
                    <h3 className="text-white font-bold text-lg leading-tight">{selectedOrder.customer}</h3>
                    <div className="flex flex-col gap-2 mt-3">
                        <div className="flex items-start gap-3 text-slate-400 text-xs">
                            <MapPin size={14} className="text-brand-cyan mt-0.5 shrink-0" />
                            <div className="leading-tight w-full">
                                <a href={`https://www.google.com/maps/search/?api=1&query={encodeURIComponent(selectedOrder.customer_address || "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline block mb-1">
                                    {selectedOrder.customer_address || "Sin dirección registrada"}
                                </a>
                                {selectedOrder.customer_commune && (
                                    <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest bg-brand-purple/10 px-2 py-0.5 rounded inline-block">
                                        {selectedOrder.customer_commune}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400 text-xs">
                            <Phone size={14} className="text-brand-cyan shrink-0" />
                            <span>{selectedOrder.customer_phone || "Sin teléfono"}</span>
                            {selectedOrder.customer_phone && (
                                <a href={`https://wa.me/${cleanPhone(selectedOrder.customer_phone)}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-2 py-1 rounded-md flex items-center gap-1 transition-all ml-auto font-bold border border-emerald-500/30"><MessageCircle size={12} /> WhatsApp</a>
                            )}
                        </div>
                    </div>
                 </div>
              </div>

              {/* GESTIÓN DE ESTADO */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado de la Orden</label>
                {editForm.status === 'En cola' ? (
                    <button onClick={(e) => handleLlegueAuto(e, null)} className="w-full bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan hover:text-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all group shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse active:scale-95">
                        <PlayCircle size={24} className="group-hover:scale-110 transition-transform" /><span className="font-black text-lg uppercase tracking-wider">¡Llegué! Comenzar</span>
                    </button>
                ) : (
                    <div className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 border ${getStatusColor(editForm.status)} bg-opacity-20`}><CheckCircle2 size={20} /><span className="font-bold text-lg uppercase tracking-wider">{editForm.status}</span></div>
                )}
              </div>

              {/* EVIDENCIA */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
                 <label className="text-[10px] font-black text-brand-purple uppercase tracking-widest mb-2 flex items-center gap-2"><Camera size={12} /> Evidencia</label>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block text-center">Ingreso</label>
                        <div className="relative aspect-square bg-slate-900 rounded-xl border-2 border-dashed border-white/10 hover:border-brand-purple/50 transition-all flex flex-col items-center justify-center overflow-hidden">
                            {uploading ? <Loader2 className="animate-spin text-brand-purple" /> : ( editForm.photoBefore ? <img src={editForm.photoBefore} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-600 mb-2" /> )}
                            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'photoBefore')} disabled={uploading} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block text-center">Salida</label>
                        <div className="relative aspect-square bg-slate-900 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center overflow-hidden">
                            {uploading ? <Loader2 className="animate-spin text-emerald-500" /> : ( editForm.photoAfter ? <img src={editForm.photoAfter} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-600 mb-2" /> )}
                            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'photoAfter')} disabled={uploading} />
                        </div>
                    </div>
                 </div>
              </div>

              {/* DATOS TÉCNICOS & OBS */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="col-span-2 text-[10px] font-black text-brand-purple uppercase tracking-widest mb-1 flex items-center gap-2"><Printer size={12} /> Datos Técnicos</div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">N° Serie</label><div className="relative"><Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input className="w-full bg-slate-900 border border-white/10 rounded-lg py-2.5 pl-9 pr-2 text-white text-xs font-mono outline-none focus:border-brand-purple" placeholder="S/N..." value={editForm.serialNumber} onChange={(e) => setEditForm({...editForm, serialNumber: e.target.value})} /></div></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Contador</label><div className="relative"><ClipboardList size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input className="w-full bg-slate-900 border border-white/10 rounded-lg py-2.5 pl-9 pr-2 text-white text-xs font-mono outline-none focus:border-brand-purple" placeholder="12345..." value={editForm.pageCount} onChange={(e) => setEditForm({...editForm, pageCount: e.target.value})} /></div></div>
              </div>

              <div className="space-y-4">
                <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Diagnóstico Real</label><textarea className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand-purple h-24 resize-none" value={editForm.probReal} onChange={(e) => setEditForm({...editForm, probReal: e.target.value})} /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Solución Aplicada</label><textarea className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand-cyan h-24 resize-none" value={editForm.solReal} onChange={(e) => setEditForm({...editForm, solReal: e.target.value})} /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Observaciones</label><textarea className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-slate-300 text-sm outline-none focus:border-white/30 h-16 resize-none" value={editForm.observations} onChange={(e) => setEditForm({...editForm, observations: e.target.value})} /></div>
              </div>

              {/* FIRMA */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3">
                 <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><PenTool size={12} /> Recepción Conforme</label>
                 <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre Quien Recibe</label><input className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-emerald-500" placeholder="Nombre completo..." value={editForm.receiverName} onChange={(e) => setEditForm({...editForm, receiverName: e.target.value})} /></div>
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Firma del Cliente</label>
                        {!showSigPad && editForm.receiverSignature && ( <button onClick={() => setShowSigPad(true)} className="text-[10px] text-brand-cyan hover:underline">Cambiar Firma</button> )}
                        {showSigPad && ( <button onClick={clearSignature} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Eraser size={10} /> Borrar</button> )}
                    </div>
                    {showSigPad ? (
                        <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-100">
                            <SignatureCanvas ref={sigPad} penColor="black" canvasProps={{ className: 'sigCanvas w-full h-32' }} />
                        </div>
                    ) : (
                        editForm.receiverSignature ? (
                            <div className="bg-white rounded-xl p-2 border border-white/10"><img src={editForm.receiverSignature} alt="Firma Cliente" className="h-20 mx-auto" /></div>
                        ) : (
                            <div className="h-32 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-slate-600 text-xs">Sin firma registrada. <button onClick={() => setShowSigPad(true)} className="ml-1 text-brand-purple font-bold">Firmar ahora</button></div>
                        )
                    )}
                 </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="p-5 border-t border-white/10 bg-slate-900 grid grid-cols-2 gap-3">
              <button onClick={() => handleSaveUpdate()} className="w-full bg-slate-800 text-slate-200 border border-white/10 py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"><Save size={16} /> Guardar Avance</button>
              <button onClick={() => handleSaveUpdate('Revisión del Coordinador')} className="w-full bg-brand-gradient text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-brand-purple/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"><Send size={16} /> Enviar Informe</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}