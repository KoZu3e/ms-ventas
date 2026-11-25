export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Microservicio de Ventas y Comprobantes API',
    version: '1.0.0',
    description: 'Gestión de órdenes de compra, validación de stock y cupones, cálculo de IVA y generación de comprobantes PDF.'
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Estado'],
        summary: 'Verificar estado del microservicio',
        responses: { 200: { description: 'Servicio operativo' } }
      }
    },
    '/api/ventas': {
      get: {
        tags: ['Ventas'],
        summary: 'Listar todas las ventas registradas (Requiere rol admin u owner)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Listado completo de ventas' },
          401: { description: 'Token ausente o inválido' },
          403: { description: 'Sin permisos de administrador' }
        }
      },
      post: {
        tags: ['Ventas'],
        summary: 'Crear una nueva venta a partir del carrito del usuario autenticado',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cliente'],
                properties: {
                  cliente: {
                    type: 'object',
                    required: ['nombre', 'apellidos', 'correo', 'calle', 'region', 'comuna'],
                    properties: {
                      nombre: { type: 'string', example: 'Bruce' },
                      apellidos: { type: 'string', example: 'Wayne' },
                      correo: { type: 'string', example: 'bruce@wayne.cl' },
                      calle: { type: 'string', example: 'Av. Gotham 100' },
                      departamento: { type: 'string', example: '12B' },
                      region: { type: 'string', example: 'Valparaíso' },
                      comuna: { type: 'string', example: 'Viña del Mar' },
                      indicaciones: { type: 'string', example: 'Dejar en conserjería' }
                    }
                  },
                  cupon: { type: 'string', example: 'HEROE20' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Venta registrada, stock descontado y carrito vaciado' },
          400: { description: 'Datos inválidos, cupón inválido o carrito vacío' },
          401: { description: 'Token ausente o inválido' },
          409: { description: 'Producto sin stock disponible' }
        }
      }
    },
    '/api/ventas/mias': {
      get: {
        tags: ['Ventas'],
        summary: 'Listar las ventas del usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista de compras del usuario' },
          401: { description: 'Token ausente o inválido' }
        }
      }
    },
    '/api/ventas/{id}': {
      get: {
        tags: ['Ventas'],
        summary: 'Obtener detalle de una venta por ID (Dueño de la compra o admin/owner)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Detalle de la venta' },
          403: { description: 'Sin permisos para ver esta venta' },
          404: { description: 'Venta no encontrada' }
        }
      }
    },
    '/api/ventas/{id}/comprobante': {
      get: {
        tags: ['Comprobantes'],
        summary: 'Obtener comprobante estructurado en JSON',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Comprobante en formato JSON' },
          403: { description: 'Sin permisos' },
          404: { description: 'Venta no encontrada' }
        }
      }
    },
    '/api/ventas/{id}/comprobante.pdf': {
      get: {
        tags: ['Comprobantes'],
        summary: 'Generar y descargar comprobante de venta en PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Archivo PDF del comprobante',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          403: { description: 'Sin permisos' },
          404: { description: 'Venta no encontrada' }
        }
      }
    },
    '/api/ventas/{id}/estado': {
      patch: {
        tags: ['Ventas'],
        summary: 'Cambiar el estado de un pedido (Requiere rol admin u owner)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estado'],
                properties: {
                  estado: { type: 'string', enum: ['Pendiente', 'Pagado', 'Enviado', 'Entregado'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Estado actualizado correctamente' },
          400: { description: 'Estado inválido' },
          403: { description: 'Sin permisos de administrador' },
          404: { description: 'Venta no encontrada' }
        }
      }
    }
  }
};
