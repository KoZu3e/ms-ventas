// Prueba de integración del flujo completo (HTTP -> servicio -> "Firestore") con una BD falsa en memoria.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// ---- Firestore falso mínimo (collection/doc/where/limit/runTransaction) ----
const store = {
  usuarios: { u1: { nombre: 'Bruce', rol: 'cliente', carrito: ['FG001', 'FG002'] }, u2: { rol: 'cliente', carrito: [] }, adm: { rol: 'admin' } },
  productos: { p1: { codigo: 'FG001', nombre: 'Figura Batman', precio: 20000, stock: 3 }, p2: { codigo: 'FG002', nombre: 'Figura Joker', precio: 10000, stock: 1 } },
  pedidos: {}, contadores: {},
};
let autoId = 0;
const snapOf = (col, id) => ({ id, exists: id in store[col], data: () => store[col][id], ref: docRef(col, id) });
function docRef(col, id) {
  return { col, id, get: async () => snapOf(col, id), update: async (d) => apply(col, id, d, true), set: async (d, o) => apply(col, id, d, false, o) };
}
function apply(col, id, d, isUpdate, opts) {
  const cur = store[col][id];
  const resolved = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v?.__inc !== undefined ? (cur?.[k] || 0) + v.__inc : v]));
  store[col][id] = isUpdate || opts?.merge ? { ...cur, ...resolved } : resolved;
}
const query = (col, filters = [], lim) => ({
  col, filters, lim,
  where: (f, _op, v) => query(col, [...filters, [f, v]], lim),
  limit: (n) => query(col, filters, n),
  get: async () => runQuery(col, filters, lim),
});
const runQuery = (col, filters, lim) => {
  let docs = Object.keys(store[col]).filter((id) => filters.every(([f, v]) => store[col][id][f] === v)).map((id) => snapOf(col, id));
  if (lim) docs = docs.slice(0, lim);
  return { empty: !docs.length, docs };
};
const fakeDb = {
  collection: (col) => ({ doc: (id = `auto${++autoId}`) => docRef(col, id), where: (...a) => query(col).where(...a) }),
  runTransaction: async (fn) => {
    const writes = [];
    const tx = {
      get: async (x) => (x.col && x.id !== undefined && !x.filters ? snapOf(x.col, x.id) : runQuery(x.col, x.filters, x.lim)),
      set: (ref, d, o) => writes.push(() => apply(ref.col, ref.id, d, false, o)),
      update: (ref, d) => writes.push(() => apply(ref.col, ref.id, d, true)),
    };
    await fn(tx);
    writes.forEach((w) => w()); // solo se aplica si no hubo excepción
  },
};
mock.module('../src/lib/firebase.js', {
  namedExports: {
    db: fakeDb,
    FieldValue: { increment: (n) => ({ __inc: n }) },
    auth: { verifyIdToken: async (t) => { if (!store.usuarios[t]) throw new Error('bad'); return { uid: t, email: `${t}@x.cl` }; } },
  },
});

const { crearApp } = await import('../src/app.js');
const server = crearApp().listen(0);
const base = `http://localhost:${server.address().port}`;
const call = (path, token, opts = {}) => fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers } });
const cliente = { nombre: 'Bruce', apellidos: 'Wayne', correo: 'b@w.cl', calle: 'Av 1', region: 'Valparaíso', comuna: 'Viña del Mar' };
let ventaId;

test('sin token -> 401', async () => assert.equal((await call('/api/ventas/mias')).status, 401));

test('crear venta: totales, comprobante, stock y carrito', async () => {
  const res = await call('/api/ventas', 'u1', { method: 'POST', body: JSON.stringify({ cliente, cupon: 'HEROE20' }) });
  assert.equal(res.status, 201);
  const d = await res.json(); ventaId = d.id;
  assert.equal(d.numeroComprobante, '00000001');
  assert.equal(d.total, 24000);                       // 30000 - 20%
  assert.equal(d.comprobante.neto + d.comprobante.iva.monto, 24000);
  assert.equal(store.productos.p1.stock, 2);
  assert.equal(store.productos.p2.stock, 0);
  assert.deepEqual(store.usuarios.u1.carrito, []);
  assert.equal(store.pedidos[ventaId].estado, 'Pagado');
});

test('carrito vacío -> 400', async () => {
  const res = await call('/api/ventas', 'u2', { method: 'POST', body: JSON.stringify({ cliente }) });
  assert.equal(res.status, 400);
});

test('sin stock -> 409 y nada se modifica', async () => {
  store.usuarios.u2.carrito = ['FG002'];
  const res = await call('/api/ventas', 'u2', { method: 'POST', body: JSON.stringify({ cliente }) });
  assert.equal(res.status, 409);
  assert.equal(store.contadores.comprobantes.ultimo, 1);
  assert.deepEqual(store.usuarios.u2.carrito, ['FG002']);
});

test('cupón inválido -> 400', async () => {
  store.usuarios.u2.carrito = ['FG001'];
  const res = await call('/api/ventas', 'u2', { method: 'POST', body: JSON.stringify({ cliente, cupon: 'FALSO' }) });
  assert.equal(res.status, 400);
});

test('permisos: dueño ve su venta, otro cliente no, admin sí', async () => {
  assert.equal((await call(`/api/ventas/${ventaId}`, 'u1')).status, 200);
  assert.equal((await call(`/api/ventas/${ventaId}`, 'u2')).status, 403);
  assert.equal((await call(`/api/ventas/${ventaId}`, 'adm')).status, 200);
});

test('PDF del comprobante', async () => {
  const res = await call(`/api/ventas/${ventaId}/comprobante.pdf`, 'u1');
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
});

test('cambio de estado: solo admin', async () => {
  const body = JSON.stringify({ estado: 'Enviado' });
  assert.equal((await call(`/api/ventas/${ventaId}/estado`, 'u1', { method: 'PATCH', body })).status, 403);
  assert.equal((await call(`/api/ventas/${ventaId}/estado`, 'adm', { method: 'PATCH', body })).status, 200);
  assert.equal(store.pedidos[ventaId].estado, 'Enviado');
});

test.after(() => server.close());
