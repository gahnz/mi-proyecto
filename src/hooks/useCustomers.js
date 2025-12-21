import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) console.error('Error cargando clientes:', error);
    else setCustomers(data || []);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, loading, refresh: fetchCustomers };
};