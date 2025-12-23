import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useWorkOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Órdenes
  const fetchOrders = async () => {
    // 👇 AQUÍ ESTABA EL ERROR: He limpiado los comentarios dentro del select
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers (
          phone,
          address,
          comuna
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error cargando órdenes:", error);
    } else {
      setOrders(data.map(o => ({
        ...o,
        db_id: o.id,               
        id: o.order_id,            
        customer: o.customer_name || "Sin Nombre", 
        device: o.device_name || "Equipo Genérico",     
        type: o.device_type,
        problem: o.reported_failure,
        technician: o.technician_name,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
        total_cost: o.total_cost,
        customer_phone: o.customers?.phone || o.customer_phone || "", 
        location: o.location || "Local", 
        customer_address: o.customers?.address || "No registrada",
        
        // Intentamos leer 'comuna' (español) o 'commune' (inglés)
        customer_commune: o.customers?.comuna || o.customers?.commune || "", 
      })));
    }
    setLoading(false);
  };

  // ⚡ SUSCRIPCIÓN EN TIEMPO REAL
  useEffect(() => {
    fetchOrders(); 

    const channel = supabase
      .channel('cambios_taller') 
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' }, // Escucha INSERT, UPDATE y DELETE
        () => { fetchOrders(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
}, []);

  // --- Funciones CRUD ---
  const createOrder = async (orderData) => {
    const { error } = await supabase.from('work_orders').insert([orderData]);
    if (error) throw error;
  };

  const createBulkOrders = async (dataArray) => {
    const { error } = await supabase.from('work_orders').insert(dataArray);
    if (error) throw error;
  };

  const updateOrder = async (uuid, updates) => {
    const { error } = await supabase.from('work_orders').update(updates).eq('id', uuid);
    if (error) throw error;
  };

  const deleteOrder = async (uuid) => {
    const { error } = await supabase.from('work_orders').delete().eq('id', uuid);
    if (error) throw error;
  };

  return { orders, loading, createOrder, createBulkOrders, updateOrder, deleteOrder, refresh: fetchOrders };
};