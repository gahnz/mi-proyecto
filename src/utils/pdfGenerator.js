import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 1. CONFIGURACIÓN
const LOGO_URL = "https://jrpgizjshhpvygkvvryt.supabase.co/storage/v1/object/public/repair-images/logo-white.png"; 

const APP_COLORS = {
  purple: [124, 58, 237], 
  cyan: [6, 182, 212],    
  gray: [241, 245, 249],  
  text: [51, 65, 85],     
  slate: [15, 23, 42]     
};

const GRADIENT_START = { r: 75, g: 225, b: 236 }; 
const GRADIENT_END = { r: 203, g: 94, b: 238 };   

const getImageData = async (url) => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error cargando imagen:", error);
        return null;
    }
};

export const generateOrderPDF = async (order) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // ---------------------------------------------------------
  // 🛡️ MAPEO SEGURO DE DATOS (Solución del problema)
  // Buscamos la propiedad mapeada (Hook) O la columna de BD
  // ---------------------------------------------------------
  const data = {
      id: order.id || order.order_id || "PENDIENTE",
      created_at: order.created_at || new Date(),
      
      // Datos Cliente
      customer: order.customer || order.customer_name || "Cliente Manual",
      phone: order.customer_phone || order.phone || "No registrado",
      
      // 👇 CAMBIO AQUÍ: Usar customer_address en lugar de location
      address: order.customer_address || order.address || "No registrada",
      
      // ... resto de datos igual ...
      device: order.device || order.device_name || "Equipo Genérico",
      type: order.type || order.device_type || "General",
      serial: order.serial_number || "S/N",
      counter: order.page_count || "N/A",
      problem: order.problem || order.reported_failure || "No especificado",
      diagnosis: order.prob_real || "",
      solution: order.sol_real || "",
      obs: order.observations || "",
      total: order.total_cost || order.cost || 0,
      items: order.items || []
  };

  // ==========================================
  // PÁGINA 1
  // ==========================================

  // --- HEADER DEGRADADO ---
  const headerHeight = 40;
  for (let x = 0; x < pageWidth; x++) {
      const ratio = x / pageWidth;
      const r = Math.round(GRADIENT_START.r + (GRADIENT_END.r - GRADIENT_START.r) * ratio);
      const g = Math.round(GRADIENT_START.g + (GRADIENT_END.g - GRADIENT_START.g) * ratio);
      const b = Math.round(GRADIENT_START.b + (GRADIENT_END.b - GRADIENT_START.b) * ratio);
      doc.setFillColor(r, g, b);
      doc.rect(x, 0, 1.2, headerHeight, "F"); 
  }

  // Logo y Textos Header
  const logoData = await getImageData(LOGO_URL);
  if (logoData) doc.addImage(logoData, "PNG", 10, 5, 30, 30); 

  const textX = logoData ? 45 : 15;
  doc.setTextColor(255, 255, 255); 
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("SERVICIO TÉCNICO", textX, 20);
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  doc.text("Gonzalo Herrera E.I.R.L", textX, 27);

  doc.setFontSize(9);
  doc.text("RUT: 77.977.057-5", pageWidth - 15, 15, { align: "right" });
  doc.text("El Molino 6496, La Florida", pageWidth - 15, 20, { align: "right" });
  doc.text("+569 9761 8174 | soporte@tecnicocomputin.cl", pageWidth - 15, 25, { align: "right" });

  // --- TÍTULO ---
  let y = 55;
  doc.setDrawColor(...APP_COLORS.purple); doc.setLineWidth(1);
  doc.line(15, y, pageWidth - 15, y);
  
  doc.setTextColor(...APP_COLORS.purple);
  doc.setFontSize(24); doc.setFont("helvetica", "bold");
  doc.text(`ORDEN #${data.id}`, 15, y - 5);

  doc.setTextColor(100); doc.setFontSize(10);
  const dateStr = new Date(data.created_at).toLocaleDateString("es-CL");
  doc.text(`FECHA INGRESO: ${dateStr}`, pageWidth - 15, y - 5, { align: "right" });

  // --- CAJAS INFO ---
  y = 65;
  const boxHeight = 35;
  const colWidth = (pageWidth - 40) / 2;

  // Caja Cliente
  doc.setFillColor(...APP_COLORS.gray);
  doc.roundedRect(15, y, colWidth, boxHeight, 3, 3, "F");
  
  doc.setTextColor(...APP_COLORS.slate); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", 20, y + 8);
  
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...APP_COLORS.text);
  doc.text(`Nombre: ${data.customer}`, 20, y + 16);
  doc.text(`Teléfono: ${data.phone}`, 20, y + 22);
  const splitAddress = doc.splitTextToSize(`Dirección: ${data.address}`, colWidth - 10);
  doc.text(splitAddress, 20, y + 28);

  // Caja Equipo
  const rightBoxX = 25 + colWidth;
  doc.setFillColor(...APP_COLORS.gray);
  doc.roundedRect(rightBoxX, y, colWidth, boxHeight, 3, 3, "F");

  doc.setTextColor(...APP_COLORS.slate); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL EQUIPO", rightBoxX + 5, y + 8);

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...APP_COLORS.text);
  doc.text(`Equipo: ${data.device}`, rightBoxX + 5, y + 16);
  doc.text(`Tipo: ${data.type}`, rightBoxX + 5, y + 22);
  doc.text(`Serie: ${data.serial}`, rightBoxX + 5, y + 28);
  doc.text(`Contador: ${data.counter}`, rightBoxX + 45, y + 28);

  y += boxHeight + 15;

  // --- CONTENIDO ---
  const printSection = (title, content, color) => {
    if (!content) return;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...color);
    doc.text(title.toUpperCase(), 15, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(0);
    const splitText = doc.splitTextToSize(content, pageWidth - 30);
    doc.text(splitText, 15, y);
    y += (splitText.length * 5) + 8;
  };

  printSection("Problema Reportado", data.problem, APP_COLORS.slate);
  printSection("Diagnóstico Técnico", data.diagnosis, APP_COLORS.cyan);
  printSection("Solución Realizada", data.solution, APP_COLORS.purple);
  printSection("Observaciones", data.obs, APP_COLORS.slate);

  // --- TABLA ---
  if (data.items.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['DESCRIPCIÓN', 'CANT.', 'PRECIO']],
      body: data.items.map(item => [item.name, item.quantity, `$${Number(item.price).toLocaleString("es-CL")}`]),
      theme: 'grid',
      headStyles: { fillColor: APP_COLORS.purple, fontSize: 10, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // --- TOTALES ---
  if (data.total > 0) {
    const total = Number(data.total);
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    const xPos = pageWidth - 15;

    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Neto: $${neto.toLocaleString("es-CL")}`, xPos, y, { align: "right" }); y += 5;
    doc.text(`IVA: $${iva.toLocaleString("es-CL")}`, xPos, y, { align: "right" }); y += 8;
    
    doc.setFontSize(14); doc.setTextColor(...APP_COLORS.purple); doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${total.toLocaleString("es-CL")}`, xPos, y, { align: "right" });
  }

  // ==========================================
  // PÁGINA 2
  // ==========================================
  doc.addPage();
  y = 20; 

  doc.setFontSize(14); doc.setTextColor(...APP_COLORS.slate); doc.setFont("helvetica", "bold");
  doc.text("ANEXO: EVIDENCIA Y RECEPCIÓN", 15, y);
  doc.line(15, y + 2, pageWidth - 15, y + 2);
  y += 15;

  if (order.photo_before || order.photo_after) {
      const imgWidth = 80; const imgHeight = 80;
      if (order.photo_before) {
          const imgData = await getImageData(order.photo_before);
          if (imgData) { doc.setFontSize(10); doc.text("ESTADO INICIAL", 15, y - 3); doc.addImage(imgData, "JPEG", 15, y, imgWidth, imgHeight); }
      }
      if (order.photo_after) {
          const imgData = await getImageData(order.photo_after);
          if (imgData) { doc.setFontSize(10); doc.text("TRABAJO FINALIZADO", 110, y - 3); doc.addImage(imgData, "JPEG", 110, y, imgWidth, imgHeight); }
      }
      y += imgHeight + 20; 
  }

  const footerY = pageHeight - 50; 
  doc.setFontSize(7); doc.setTextColor(100);
  const terms = "TÉRMINOS: 1. El cliente autoriza el diagnóstico. 2. La empresa no se hace responsable por pérdida de datos. 3. Equipos abandonados por más de 90 días pasarán a bodega. 4. Garantía técnica de 3 meses.";
  doc.text(doc.splitTextToSize(terms, pageWidth - 30), 15, pageHeight - 25);

  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(30, footerY, 90, footerY); 
  doc.line(120, footerY, 180, footerY); 

  if (order.receiver_signature) {
      const signatureImg = await getImageData(order.receiver_signature);
      if (signatureImg) doc.addImage(signatureImg, "PNG", 35, footerY - 25, 50, 25);
  }

  doc.setFontSize(8); doc.setTextColor(0); doc.setFont("helvetica", "normal");
  const receiverLabel = order.receiver_name ? `Recibido por: ${order.receiver_name}` : "Firma Cliente";
  doc.text(receiverLabel, 60, footerY + 5, { align: "center", maxWidth: 50 });
  doc.text("Gonzalo Herrera E.I.R.L", 150, footerY + 5, { align: "center" });

  doc.autoPrint();
  window.open(URL.createObjectURL(doc.output("blob")), "_blank");
};