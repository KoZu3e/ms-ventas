import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { calcularTotales, validarCliente } from '../src/lib/calculos.js';
import { armarComprobante, generarPDF } from '../src/services/comprobante.js';

test('totales con descuento e IVA incluido', () => {
  const t = calcularTotales([{ precio: 10000, cantidad: 2 }, { precio: 5000, cantidad: 1 }], 20, 19);
  assert.equal(t.subtotal, 25000);
  assert.equal(t.montoDescuento, 5000);
  assert.equal(t.total, 20000);
  assert.equal(t.neto + t.iva, t.total);
  assert.equal(t.neto, 16807);
});

test('validación de cliente', () => {
  assert.match(validarCliente({}), /Faltan datos/);
  assert.equal(validarCliente({ nombre: 'a', apellidos: 'b', correo: 'a@b.cl', calle: 'x', region: 'r', comuna: 'c' }), null);
});

test('genera PDF válido', async () => {
  const venta = { id: 'abc', numeroComprobante: 7, fecha: new Date().toISOString(), estado: 'Pagado',
    cliente: { nombre: 'Bruce', apellidos: 'Wayne', correo: 'b@w.cl', calle: 'Av 1', departamento: '', comuna: 'Viña del Mar', region: 'Valparaíso' },
    productos: [{ codigo: 'FG001', nombre: 'Figura Batman', precio: 19990, cantidad: 1 }],
    subtotal: 19990, descuentoAplicado: 0, montoDescuento: 0, neto: 16798, iva: 3192, ivaPorcentaje: 19, total: 19990, cupon: null };
  assert.equal(armarComprobante(venta).numero, '00000007');
  const s = new PassThrough(); const chunks = [];
  s.on('data', (c) => chunks.push(c));
  const fin = new Promise((r) => s.on('end', r));
  generarPDF(venta, s); await fin;
  assert.equal(Buffer.concat(chunks).subarray(0, 4).toString(), '%PDF');
});
