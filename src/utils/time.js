export const getChileTime = () => {
    // 1. Obtenemos la fecha actual
    const now = new Date();

    // 2. Forzamos la conversión a la zona horaria de Santiago
    const chileDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));

    // 3. Formateamos manualmente a YYYY-MM-DDTHH:mm (Formato ISO local)
    const yyyy = chileDate.getFullYear();
    const mm = String(chileDate.getMonth() + 1).padStart(2, '0');
    const dd = String(chileDate.getDate()).padStart(2, '0');
    const hh = String(chileDate.getHours()).padStart(2, '0');
    const min = String(chileDate.getMinutes()).padStart(2, '0');
    const ss = String(chileDate.getSeconds()).padStart(2, '0');

    // Retornamos formato compatible con Supabase y inputs HTML
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
};

// Para formatear lo que viene de la base de datos al mostrarlo
export const formatDateChile = (isoString) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleString('es-CL', { 
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};