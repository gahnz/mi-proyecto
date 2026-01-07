import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase/client";
import { toast } from "sonner";

// Hook para gestionar el Flujo de Caja con paginación y filtros en servidor
export function useCashFlow(
  page = 1,
  pageSize = 20,
  selectedMonth,
  searchTerm = "",
  filterType = "Todos"
) {
  const [movements, setMovements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mapeo de datos para unificar nombres con el frontend
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
    items: m.items || [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Validar mes seleccionado (fallback al actual si no viene)
      const targetMonth = selectedMonth || new Date().toISOString().slice(0, 7);

      // 1. Cargar Estadísticas Rápidas (RPC)
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_monthly_cashflow_stats",
        { month_date: targetMonth }
      );
      if (statsError) throw statsError;
      setStats(statsData);

      // 2. Cargar Movimientos Paginados y Filtrados
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const startDate = `${targetMonth}-01`;
      const endDate = `${targetMonth}-31`;

      let query = supabase
        .from("cash_flow")
        .select("*", { count: "exact" })
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      // --- FILTROS DE SERVIDOR ---
      if (searchTerm) {
        // Busca coincidencias en descripción O número de documento
        query = query.or(
          `description.ilike.%${searchTerm}%,doc_number.ilike.%${searchTerm}%`
        );
      }

      if (filterType !== "Todos") {
        const typeValue = filterType === "Ingresos" ? "income" : "expense";
        query = query.eq("type", typeValue);
      }

      // Ejecutar consulta con paginación
      const { data, count, error } = await query.range(from, to);

      if (error) throw error;

      setMovements(data.map(mapMovement) || []);
      setTotalCount(count);
    } catch (error) {
      console.error("Error cargando flujo:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedMonth, searchTerm, filterType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- MÉTODOS CRUD ---

  const addMovement = async (movement) => {
    try {
      const { error } = await supabase.from("cash_flow").insert([
        {
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
          status: movement.status || "confirmed",
          delivery_by: movement.deliveryBy,
          doc_url: movement.docUrl,
          items: movement.items,
        },
      ]);

      if (error) throw error;
      fetchData(); // Recargar datos
    } catch (err) {
      throw err;
    }
  };

  const updateMovement = async (id, updatedFields) => {
    try {
      const { error } = await supabase
        .from("cash_flow")
        .update({
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
          items: updatedFields.items,
        })
        .eq("id", id);

      if (error) throw error;
      fetchData(); // Recargar datos
    } catch (err) {
      throw err;
    }
  };

  const deleteMovement = async (id) => {
    try {
      const { error } = await supabase.from("cash_flow").delete().eq("id", id);
      if (error) throw error;
      fetchData(); // Recargar datos
    } catch (err) {
      throw err;
    }
  };

  const uploadDocument = async (id, file) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `voucher_${id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("finance-docs")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("finance-docs").getPublicUrl(fileName);
      await supabase
        .from("cash_flow")
        .update({ doc_url: publicUrl })
        .eq("id", id);
      fetchData();
      return publicUrl;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  return {
    movements,
    stats,
    totalCount,
    loading,
    addMovement,
    updateMovement,
    deleteMovement,
    uploadDocument,
    refresh: fetchData,
  };
}
