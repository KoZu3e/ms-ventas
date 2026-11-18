// Precios en CLP (enteros) con IVA incluido.
export const CUPONES = { BATI67: 67, HEROE20: 20, VILLANO50: 50 };

export function calcularTotales(items, porcentajeDescuento = 0, ivaPct = 19) {
  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const montoDescuento = Math.trunc((subtotal * porcentajeDescuento) / 100);
  const total = subtotal - montoDescuento;
  const neto = Math.round(total / (1 + ivaPct / 100));
  const iva = total - neto;
  return { subtotal, montoDescuento, total, neto, iva };
}

export function validarCliente(c = {}) {
  const req = ['nombre', 'apellidos', 'correo', 'calle', 'region', 'comuna'];
  const faltan = req.filter((k) => !String(c[k] ?? '').trim());
  if (faltan.length) return `Faltan datos del cliente: ${faltan.join(', ')}`;
  if (!/^\S+@\S+\.\S+$/.test(c.correo)) return 'Correo inválido';
  return null;
}

export const formatoCLP = (n) => '$' + Number(n).toLocaleString('es-CL');
