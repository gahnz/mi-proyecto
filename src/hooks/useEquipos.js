import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useEquipos = () => {
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar equipos
  const fetchEquipos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipment_models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando equipos:', error);
      setError(error.message);
    } else {
      setEquipments(data);
    }
    setLoading(false);
  };

  // Crear nuevo equipo
  const addEquipo = async (equipo) => {
    const { error } = await supabase
      .from('equipment_models')
      .insert([{ 
        type: equipo.type, 
        brand: equipo.brand, 
        model: equipo.model 
      }]);
    
    if (error) throw error;
    await fetchEquipos(); // Recargar lista
  };

  // Editar equipo
  const updateEquipo = async (id, updatedFields) => {
    const { error } = await supabase
      .from('equipment_models')
      .update(updatedFields)
      .eq('id', id);

    if (error) throw error;
    await fetchEquipos();
  };

  // Eliminar equipo
  const deleteEquipo = async (id) => {
    const { error } = await supabase
      .from('equipment_models')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchEquipos();
  };

  // Cargar al iniciar
  useEffect(() => {
    fetchEquipos();
  }, []);

  return { 
    equipments, 
    loading, 
    error, 
    addEquipo, 
    updateEquipo, 
    deleteEquipo 
  };
};