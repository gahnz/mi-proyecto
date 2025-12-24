import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Clientes
  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('full_name', { ascending: true }); // Ordenar alfabéticamente

    if (error) {
      console.error('Error cargando clientes:', error);
    } else {
      setCustomers(data || []);
    }
    
    setLoading(false);
  };

  // 2. Crear Cliente (Compatible con toast.promise)
  const addCustomer = async (customerData) => {
    // Eliminamos ID si viene vacío para que Supabase lo genere
    const { id, ...dataToSave } = customerData;
    
    const { data, error } = await supabase
      .from('customers')
      .insert([dataToSave])
      .select();

    if (error) throw error; // Lanzar error para que el toast lo detecte
    await fetchCustomers(); // Recargar la lista
    return data;
  };

  // 3. Actualizar Cliente
  const updateCustomer = async (id, updates) => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    await fetchCustomers();
    return data;
  };

  // 4. Eliminar Cliente
  const deleteCustomer = async (id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchCustomers();
  };

  // Cargar al inicio
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Exportar todo (AQUÍ FALTABA EXPORTAR LAS FUNCIONES)
  return { 
    customers, 
    loading, 
    addCustomer, 
    updateCustomer, 
    deleteCustomer,
    refresh: fetchCustomers 
  };
};