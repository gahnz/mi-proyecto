import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useWorkOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Órdenes
  const fetchOrders = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers (
          phone,
          address
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
        date: new Date(o.created_at).toLocaleDateString('es-CL'),
        total_cost: o.total_cost, // Aseguramos que pase el costo total
        customer_phone: o.customers?.phone || o.customer_phone || "", 
        location: o.customers?.address || o.location || "Local",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // 2. Crear Orden
  const createOrder = async (orderData) => {
    const { error } = await supabase.from('work_orders').insert([orderData]);
    if (error) throw error;
    await fetchOrders();
  };

  // 3. Actualizar Orden
  const updateOrder = async (uuid, updates) => {
    const { error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', uuid);

    if (error) throw error;
    await fetchOrders();
  };

  // 4. 👇 NUEVA FUNCIÓN: ELIMINAR ORDEN
  const deleteOrder = async (uuid) => {
    const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', uuid);

    if (error) throw error;
    await fetchOrders(); // Recargar la lista
  };

  return { orders, loading, createOrder, updateOrder, deleteOrder, refresh: fetchOrders };
};