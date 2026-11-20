import PDFDocument from 'pdfkit';
import { formatoCLP, calcularTotales } from '../lib/calculos.js';

export const numeroFormateado = (n) => String(n ?? 0).padStart(8, '0');

/** JSON del comprobante (mismo contenido que el PDF). */
export function armarComprobante(v) {
  const productos = (v.productos || []).map((p) => ({ ...p, cantidad: p.cantidad || 1, precio: Number(p.precio) || 0 }));
  const ivaPct = v.ivaPorcentaje ?? 19;
  const descPct = v.descuentoAplicado ?? 0;
  const fallback = calcularTotales(productos, descPct, ivaPct);

  return {
    empresa: { nombre: process.env.EMPRESA_NOMBRE || 'La BatiTienda', direccion: process.env.EMPRESA_DIRECCION || '' },
    numero: numeroFormateado(v.numeroComprobante),
    idVenta: v.id,
    fecha: v.fecha,
    estado: v.estado,
    cliente: v.cliente || {},
    items: productos.map((p) => ({ ...p, totalLinea: p.precio * p.cantidad })),
    subtotal: v.subtotal ?? fallback.subtotal,
    descuento: { porcentaje: descPct, monto: v.montoDescuento ?? fallback.montoDescuento, cupon: v.cupon ?? null },
    neto: v.neto ?? fallback.neto,
    iva: { porcentaje: ivaPct, monto: v.iva ?? fallback.iva },
    total: v.total ?? fallback.total,
  };
}

/** Genera el PDF y lo escribe en el stream recibido (p. ej. la respuesta HTTP). */
export function generarPDF(v, stream) {
  const c = armarComprobante(v);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(stream);

  doc.fontSize(20).text(c.empresa.nombre, { align: 'left' });
  doc.fontSize(10).fillColor('#555').text(c.empresa.direccion);
  doc.moveUp(2).fontSize(14).fillColor('#000').text(`COMPROBANTE DE VENTA N° ${c.numero}`, { align: 'right' });
  doc.fontSize(10).fillColor('#555').text(`Fecha: ${new Date(c.fecha).toLocaleString('es-CL')}`, { align: 'right' });
  doc.text(`Orden: ${c.idVenta}`, { align: 'right' });
  doc.moveDown(2).fillColor('#000');

  doc.fontSize(11).text('Cliente', { underline: true });
  doc.fontSize(10)
    .text(`${c.cliente.nombre} ${c.cliente.apellidos} — ${c.cliente.correo}`)
    .text(`${c.cliente.calle} ${c.cliente.departamento || ''}, ${c.cliente.comuna}, ${c.cliente.region}`);
  doc.moveDown();

  // Tabla de productos
  const x = { cod: 50, nom: 120, cant: 360, pu: 410, tot: 480 };
  let y = doc.y + 5;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Código', x.cod, y).text('Producto', x.nom, y).text('Cant.', x.cant, y).text('P. unit.', x.pu, y).text('Total', x.tot, y);
  doc.font('Helvetica').moveTo(50, y + 14).lineTo(545, y + 14).stroke();
  y += 20;
  for (const it of c.items) {
    doc.text(it.codigo, x.cod, y, { width: 65 })
      .text(it.nombre, x.nom, y, { width: 235 })
      .text(String(it.cantidad), x.cant, y)
      .text(formatoCLP(it.precio), x.pu, y)
      .text(formatoCLP(it.totalLinea), x.tot, y);
    y += 18;
    if (y > 740) { doc.addPage(); y = 50; }
  }
  doc.moveTo(50, y).lineTo(545, y).stroke();
  y += 10;

  const fila = (label, valor, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 360, y).text(valor, 480, y);
    y += 16;
  };
  fila('Subtotal:', formatoCLP(c.subtotal));
  if (c.descuento.porcentaje > 0) fila(`Descuento (${c.descuento.porcentaje}%):`, '-' + formatoCLP(c.descuento.monto));
  fila('Neto:', formatoCLP(c.neto));
  fila(`IVA (${c.iva.porcentaje}%):`, formatoCLP(c.iva.monto));
  fila('TOTAL:', formatoCLP(c.total), true);

  doc.font('Helvetica').fontSize(8).fillColor('#777')
    .text('Comprobante interno de venta. No reemplaza una boleta/factura electrónica del SII.', 50, 780, { align: 'center' });
  doc.end();
}
