import { db, FieldValue } from '../lib/firebase.js';
import { CUPONES, calcularTotales, validarCliente } from '../lib/calculos.js';

const IVA = Number(process.env.IVA_PORCENTAJE || 19);
export const ESTADOS = ['Pendiente', 'Pagado', 'Enviado', 'Entregado'];

export class ErrorVenta extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/**
 * Crea la venta leyendo el carrito desde Firestore (el cliente NO envía precios).
 * En una sola transacción: valida stock, descuenta stock, numera el comprobante,
 * crea el pedido y vacía el carrito.
 */
export async function crearVenta(uid, { cliente, cupon }) {
  const errCliente = validarCliente(cliente);
  if (errCliente) throw new ErrorVenta(400, errCliente);

  let porcentaje = 0;
  if (cupon) {
    porcentaje = CUPONES[String(cupon).trim().toUpperCase()];
    if (!porcentaje) throw new ErrorVenta(400, 'Cupón inválido');
  }

  const userRef = db.collection('usuarios').doc(uid);
  const contadorRef = db.collection('contadores').doc('comprobantes');
  const pedidoRef = db.collection('pedidos').doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const codigos = [...new Set(userSnap.data()?.carrito || [])];
    if (!codigos.length) throw new ErrorVenta(400, 'El carrito está vacío');

    // Todas las lecturas primero (requisito de Firestore)
    const prodSnaps = await Promise.all(
      codigos.map((c) => tx.get(db.collection('productos').where('codigo', '==', c).limit(1)))
    );
    const contadorSnap = await tx.get(contadorRef);

    const items = [];
    const descuentosStock = [];
    prodSnaps.forEach((qs, i) => {
      if (qs.empty) throw new ErrorVenta(409, `El producto ${codigos[i]} ya no existe`);
      const doc = qs.docs[0];
      const p = doc.data();
      if (typeof p.stock === 'number' && p.stock < 1) {
        throw new ErrorVenta(409, `Sin stock: ${p.nombre}`);
      }
      items.push({ codigo: p.codigo, nombre: p.nombre, precio: Number(p.precio), cantidad: 1, imagen: p.imagen || '' });
      if (typeof p.stock === 'number') descuentosStock.push(doc.ref);
    });

    const numero = (contadorSnap.data()?.ultimo || 0) + 1;
    const t = calcularTotales(items, porcentaje, IVA);

    tx.set(contadorRef, { ultimo: numero }, { merge: true });
    descuentosStock.forEach((ref) => tx.update(ref, { stock: FieldValue.increment(-1) }));
    tx.set(pedidoRef, {
      uid,
      cliente,
      productos: items,
      subtotal: t.subtotal,
      descuentoAplicado: porcentaje,
      montoDescuento: t.montoDescuento,
      cupon: porcentaje ? String(cupon).trim().toUpperCase() : null,
      neto: t.neto,
      iva: t.iva,
      ivaPorcentaje: IVA,
      total: t.total,
      numeroComprobante: numero,
      fecha: new Date().toISOString(),
      estado: 'Pagado',
    });
    tx.set(userRef, { carrito: [] }, { merge: true });
  });

  const snap = await pedidoRef.get();
  return { id: pedidoRef.id, ...snap.data() };
}

export async function obtenerVenta(id, user) {
  const snap = await db.collection('pedidos').doc(id).get();
  if (!snap.exists) throw new ErrorVenta(404, 'Venta no encontrada');
  const venta = { id: snap.id, ...snap.data() };
  if (venta.uid !== user.uid && !['admin', 'owner'].includes(user.rol)) {
    throw new ErrorVenta(403, 'No tienes permisos para ver esta venta');
  }
  return venta;
}

export async function listarVentasUsuario(uid) {
  const qs = await db.collection('pedidos').where('uid', '==', uid).get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function listarTodasVentas() {
  const qs = await db.collection('pedidos').get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function cambiarEstado(id, estado) {
  if (!ESTADOS.includes(estado)) throw new ErrorVenta(400, `Estado inválido. Use: ${ESTADOS.join(', ')}`);
  const ref = db.collection('pedidos').doc(id);
  if (!(await ref.get()).exists) throw new ErrorVenta(404, 'Venta no encontrada');
  await ref.update({ estado });
  return { id, estado };
}
