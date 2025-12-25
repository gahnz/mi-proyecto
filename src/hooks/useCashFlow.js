import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase/client";
import { toast } from "sonner";

// Agregamos paginación por defecto: página 1, 20 items
export function useCashFlow(page = 1, pageSize = 20, selectedMonth = new Date().toISOString().slice(0, 7)) {
  const [movements, setMovements] = useState([]);
  const [totalCount, setTotalCount] = useState(0); // Nuevo total
  const [stats, setStats] = useState(null); // Nuevas estadísticas
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
    items: m.items || [] 
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar Estadísticas Rápidas (RPC)
      const { data: statsData, error: statsError } = await supabase.rpc('get_monthly_cashflow_stats', { month_date: selectedMonth });
      if (statsError) throw statsError;
      setStats(statsData);

      // 2. Cargar Movimientos Paginados
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Filtramos por el mes seleccionado para la tabla también
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;

      const { data, count, error } = await supabase
        .from("cash_flow")
        .select("*", { count: 'exact' })
        .gte('date', startDate)
        .lte('date', endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setMovements(data.map(mapMovement) || []);
      setTotalCount(count);

    } catch (error) {
      console.error("Error cargando flujo:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- MÉTODOS CRUD (Sin cambios mayores, solo refrescar al final) ---

  const addMovement = async (movement) => {
      try {
        const { error } = await supabase.from("cash_flow").insert([{
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
            items: movement.items 
        }]);
        
        if (error) throw error;
        fetchData(); // Recargar todo (stats + tabla)
      } catch(err) { throw err; }
  };

  const updateMovement = async (id, updatedFields) => {
      try {
        const { error } = await supabase.from("cash_flow").update({
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
            items: updatedFields.items
        }).eq("id", id);

        if (error) throw error;
        fetchData(); // Recargar
      } catch(err) { throw err; }
  };
  
  const deleteMovement = async (id) => {
      try {
        const { error } = await supabase.from("cash_flow").delete().eq("id", id);
        if (error) throw error;
        fetchData(); // Recargar
      } catch(err) { throw err; }
  };

  const uploadDocument = async (id, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `voucher_${id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('finance-docs').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('finance-docs').getPublicUrl(fileName);
      await supabase.from('cash_flow').update({ doc_url: publicUrl }).eq('id', id);
      fetchData(); // Recargar
      return publicUrl;
    } catch (error) { console.error(error); throw error; }
  };

  return { 
    movements, 
    stats, // 👈 Ahora devolvemos estadísticas calculadas
    totalCount, 
    loading, 
    addMovement, 
    updateMovement, 
    deleteMovement, 
    uploadDocument, 
    refresh: fetchData 
  };
}