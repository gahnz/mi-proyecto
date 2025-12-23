import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase/client";
import { toast } from "sonner";

export function useCashFlow() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mapeo incluyendo docUrl e items
  const mapMovement = (m) => ({
    ...m,
    totalAmount: m.total_amount,
    netAmount: m.net_amount,
    taxAmount: m.tax_amount,
    paymentMethod: m.payment_method,
    docType: m.doc_type,
    docNumber: m.doc_number,
    isEcommerce: m.is_ecommerce,
    deliveryBy: m.delivery_by,
    status: m.status,
    docUrl: m.doc_url,
    items: m.items || [] // 👈 NUEVO: Mapear items
  });

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cash_flow")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMovements(data.map(mapMovement) || []);
    } catch (error) {
      console.error("Error cargando flujo:", error);
      toast.error("Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const addMovement = async (movement) => {
      try {
        const { data, error } = await supabase.from("cash_flow").insert([{
            date: movement.date,
            type: movement.type,
            category: movement.category,
            description: movement.description,
            payment_method: movement.paymentMethod,
            net_amount: movement.netAmount,
            tax_amount: movement.taxAmount,
            total_amount: movement.totalAmount,
            doc_type: movement.docType,
            doc_number: movement.docNumber,
            is_ecommerce: movement.isEcommerce,
            status: movement.status || 'confirmed',
            delivery_by: movement.deliveryBy,
            doc_url: movement.docUrl,
            items: movement.items // 👈 NUEVO: Guardar items
        }]).select();
        
        if (error) throw error;
        const newMov = mapMovement(data[0]);
        setMovements((prev) => [newMov, ...prev]);
        return newMov;
      } catch(err) { throw err; }
  };

  const updateMovement = async (id, updatedFields) => {
      try {
        const { data, error } = await supabase.from("cash_flow").update({
            date: updatedFields.date,
            type: updatedFields.type,
            category: updatedFields.category,
            description: updatedFields.description,
            payment_method: updatedFields.paymentMethod,
            net_amount: updatedFields.netAmount,
            tax_amount: updatedFields.taxAmount,
            total_amount: updatedFields.totalAmount,
            doc_type: updatedFields.docType,
            doc_number: updatedFields.docNumber,
            is_ecommerce: updatedFields.isEcommerce,
            status: updatedFields.status,
            delivery_by: updatedFields.deliveryBy,
            doc_url: updatedFields.docUrl,
            items: updatedFields.items // 👈 NUEVO: Actualizar items
        }).eq("id", id).select();

        if (error) throw error;
        const updatedMov = mapMovement(data[0]);
        setMovements((prev) => prev.map((m) => (m.id === id ? updatedMov : m)));
        return updatedMov;
      } catch(err) { throw err; }
  };
  
  const deleteMovement = async (id) => {
      try {
        const { error } = await supabase.from("cash_flow").delete().eq("id", id);
        if (error) throw error;
        setMovements((prev) => prev.filter((m) => m.id !== id));
      } catch(err) { throw err; }
  };

  const uploadDocument = async (id, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `voucher_${id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('finance-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('finance-docs')
        .getPublicUrl(fileName);

      const { data, error: dbError } = await supabase
        .from('cash_flow')
        .update({ doc_url: publicUrl })
        .eq('id', id)
        .select();

      if (dbError) throw dbError;

      const updatedMov = mapMovement(data[0]);
      setMovements(prev => prev.map(m => m.id === id ? updatedMov : m));
      
      return publicUrl;
    } catch (error) {
      console.error("Error subiendo documento:", error);
      throw error;
    }
  };

  return { movements, loading, addMovement, updateMovement, deleteMovement, uploadDocument, refresh: fetchMovements };
}