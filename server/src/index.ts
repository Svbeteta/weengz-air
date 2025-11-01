import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { sendUserCreatedEmail, sendReservationConfirmationEmail,  sendReservationCancellationEmail, sendReservationsBatchConfirmationEmail } from './mailer';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Swagger UI (OpenAPI)
try {
  const openapiPath = path.resolve(__dirname, '../openapi.yaml');
  const swaggerDocument = YAML.load(openapiPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('Swagger UI available at /api-docs');
} catch (e) {
  console.warn('OpenAPI spec not found or invalid. Skipping Swagger UI.');
}

// Usuarios
app.get('/usuarios', async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({ orderBy: { id: 'asc' } });
  res.json(usuarios);
});

app.post('/usuarios', async (req, res) => {
  const u = req.body;
  const created = await prisma.usuario.create({ data: {
    email: u.email,
    nombreCompleto: u.nombreCompleto,
    fechaCreacion: new Date(u.fechaCreacion ?? new Date().toISOString()),
    esVip: !!u.esVip,
    reservasCount: u.reservasCount ?? 0,
  }});
  // Fire-and-forget confirmation email (non-blocking for response)
  sendUserCreatedEmail(created.email, created.nombreCompleto).catch(() => {});
  res.status(201).json(created);
});

app.patch('/usuarios/:id', async (req, res) => {
  const id = Number(req.params.id);
  const patch = req.body;
  const updated = await prisma.usuario.update({ where: { id }, data: patch });
  res.json(updated);
});

// Asientos
app.get('/asientos', async (_req, res) => {
  const asientos = await prisma.asiento.findMany({ orderBy: { numero: 'asc' } });
  res.json(asientos);
});

app.patch('/asientos/:id', async (req, res) => {
  const id = String(req.params.id);
  const patch = req.body;
  const updated = await prisma.asiento.update({ where: { id }, data: patch });
  res.json(updated);
});

// Reservaciones
app.get('/reservaciones', async (_req, res) => {
  const rs = await prisma.reservacion.findMany({ include: { Modificaciones: true }, orderBy: { id: 'asc' } });
  res.json(rs.map(r => ({
    id: r.id,
    estado: r.estado,
    usuario: r.usuario,
    asiento: r.asiento,
    pasajero: { nombreCompleto: r.pasajeroNombre, cui: r.pasajeroCui, tieneEquipaje: r.pasajeroEquipaje },
    detalles: { fechaReservacion: r.fechaReservacion, metodoSeleccion: r.metodoSeleccion, precioBase: r.precioBase, precioTotal: r.precioTotal },
    Modificaciones: r.Modificaciones
  })));
});

app.post('/reservaciones', async (req, res) => {
  const r = req.body;
  const created = await prisma.reservacion.create({ data: {
    estado: r.estado,
    usuario: r.usuario,
    asiento: r.asiento,
    pasajeroNombre: r.pasajero?.nombreCompleto,
    pasajeroCui: r.pasajero?.cui,
    pasajeroEquipaje: !!r.pasajero?.tieneEquipaje,
    fechaReservacion: new Date(r.detalles?.fechaReservacion ?? new Date().toISOString()),
    metodoSeleccion: r.detalles?.metodoSeleccion,
    precioBase: Number(r.detalles?.precioBase ?? 0),
    precioTotal: Number(r.detalles?.precioTotal ?? 0),
  }});
  res.status(201).json(created);
});

app.patch('/reservaciones/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body;
  const updated = await prisma.reservacion.update({ where: { id }, data: {
    estado: p.estado,
    usuario: p.usuario,
    asiento: p.asiento,
    pasajeroNombre: p.pasajero?.nombreCompleto,
    pasajeroCui: p.pasajero?.cui,
    pasajeroEquipaje: p.pasajero?.tieneEquipaje,
    fechaReservacion: p.detalles?.fechaReservacion ? new Date(p.detalles.fechaReservacion) : undefined,
    metodoSeleccion: p.detalles?.metodoSeleccion,
    precioBase: p.detalles?.precioBase,
    precioTotal: p.detalles?.precioTotal,
  }});
  res.json(updated);
});

app.delete('/reservaciones/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.reservacion.delete({ where: { id } });
  res.status(204).end();
});

// Atomic create: validate seat is Libre, create reservation, mark seat Ocupado, update user counters
app.post('/reservaciones/atomic', async (req, res) => {
  const r = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const seat = await tx.asiento.findUnique({ where: { id: r.asiento } });
      if (!seat) throw new Error('Asiento no existe');
      if (seat.estado === 'Ocupado') throw new Error('Asiento ocupado');

      // VIP/Descuento server-side
      const user = await tx.usuario.findUnique({ where: { email: r.usuario } });
      const vip = !!(user?.esVip || (user?.reservasCount ?? 0) >= 5);
      const descuento = vip ? 0.1 : 0;
      const precioBase = Number(r.detalles?.precioBase ?? 0);
      const precioTotal = Number((precioBase * (1 - descuento)).toFixed(2));

      const created = await tx.reservacion.create({ data: {
        estado: 'ACTIVA',
        usuario: r.usuario,
        asiento: r.asiento,
        pasajeroNombre: r.pasajero?.nombreCompleto,
        pasajeroCui: r.pasajero?.cui,
        pasajeroEquipaje: !!r.pasajero?.tieneEquipaje,
        fechaReservacion: new Date(r.detalles?.fechaReservacion ?? new Date().toISOString()),
        metodoSeleccion: r.detalles?.metodoSeleccion,
        precioBase,
        precioTotal,
      }});

      await tx.asiento.update({ where: { id: r.asiento }, data: { estado: 'Ocupado' } });

      // Update user counters/VIP flag
      if (user?.id) {
        const newCount = (user.reservasCount ?? 0) + 1;
        const becameVip = newCount >= 5;
        await tx.usuario.update({ where: { id: user.id }, data: { reservasCount: newCount, esVip: user.esVip || becameVip } });
      }

      return created;
    });
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'No se pudo crear la reservación' });
  }
});

// Modify reservation: change seat within same class, add 10% surcharge, update seat states atomically
app.post('/reservaciones/:id/modificar', async (req, res) => {
  const id = Number(req.params.id);
  const { nuevoAsiento, descripcion, cui } = req.body as { nuevoAsiento: string; descripcion?: string; cui?: string };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reservacion.findUnique({ where: { id } });
      if (!r) throw new Error('Reservación no existe');
      // Validate CUI matches reservation
      const normalize = (s?: string | null) => (s || '').replace(/\D/g, '');
      if (normalize(cui) !== normalize(r.pasajeroCui)) {
        throw new Error('CUI no coincide con la reservación');
      }
      const from = await tx.asiento.findUnique({ where: { id: r.asiento } });
      const to = await tx.asiento.findUnique({ where: { id: nuevoAsiento } });
      if (!from || !to) throw new Error('Asiento inválido');
      if (to.estado === 'Ocupado') throw new Error('Asiento destino ocupado');
      if (from.clase !== to.clase) throw new Error('Debe ser la misma clase');

      const recargo = Number((r.precioBase * 0.10).toFixed(2));
      const nuevoPrecio = Number((r.precioTotal + recargo).toFixed(2));
      const updated = await tx.reservacion.update({ where: { id }, data: { asiento: nuevoAsiento, precioTotal: nuevoPrecio } });

      await tx.modificacion.create({ data: {
        descripcion: descripcion ?? `Cambio de ${r.asiento} a ${nuevoAsiento}.`,
        recargo,
        fecha: new Date(),
        reservacionId: id,
      }});

      await tx.asiento.update({ where: { id: r.asiento }, data: { estado: 'Libre' } });
      await tx.asiento.update({ where: { id: nuevoAsiento }, data: { estado: 'Ocupado' } });
      return updated;
    });
    res.json(result);

    // send updated reservation email after modification
    try {
      const seat = await prisma.asiento.findUnique({ where: { id: result.asiento } });
      const user = await prisma.usuario.findUnique({ where: { email: result.usuario } });
      const modificaciones = await prisma.modificacion.findMany({ where: { reservacionId: id } });
      sendReservationConfirmationEmail({
        to: result.usuario,
        userName: user?.nombreCompleto,
        reservation: result as any,
        seat: seat as any,
        modificaciones: modificaciones as any
      }).catch(() => {});
    } catch (e) {
      // ignore
    }
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'No se pudo modificar' });
  }
});

// Cancel reservation: mark reservation and free seat atomically
app.post('/reservaciones/:id/cancelar', async (req, res) => {
  const id = Number(req.params.id);
  const { cui } = req.body as { cui?: string };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reservacion.findUnique({ where: { id }, include: { Modificaciones: true } });
      if (!r) throw new Error('Reservación no existe');
      // Validate CUI matches reservation
      const normalize = (s?: string | null) => (s || '').replace(/\D/g, '');
      if (normalize(cui) !== normalize(r.pasajeroCui)) throw new Error('CUI no coincide con la reservación');
      const seat = await tx.asiento.findUnique({ where: { id: r.asiento } });
      const updated = await tx.reservacion.update({ where: { id }, data: { estado: 'CANCELADA' } });
      await tx.asiento.update({ where: { id: r.asiento }, data: { estado: 'Libre' } });
      return { original: r, updated, seat };
    });

    // send cancellation email (non-blocking)
    const user = await prisma.usuario.findUnique({ where: { email: result.updated.usuario } });
    sendReservationCancellationEmail({
      to: result.updated.usuario,
      userName: user?.nombreCompleto,
      reservation: {
        id: result.updated.id,
        estado: result.updated.estado,
        usuario: result.updated.usuario,
        asiento: result.updated.asiento,
        pasajeroNombre: result.original.pasajeroNombre,
        pasajeroCui: result.original.pasajeroCui,
        pasajeroEquipaje: !!result.original.pasajeroEquipaje,
        fechaReservacion: result.original.fechaReservacion,
        metodoSeleccion: result.original.metodoSeleccion,
        precioBase: Number(result.original.precioBase ?? 0),
        precioTotal: Number(result.original.precioTotal ?? 0)
      },
      seat: result.seat ? { id: result.seat.id, numero: result.seat.numero, clase: result.seat.clase } : undefined,
      modificaciones: result.original.Modificaciones || []
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'No se pudo cancelar' });
  }
});

// Module-level set to track ids confirmed by batch (used to avoid duplicate individual emails)
const batchConfirmedIds = new Set<number>();
function markBatchConfirmed(ids: number[], ttlMs = 10000) {
  ids.forEach(id => batchConfirmedIds.add(id));
  setTimeout(() => ids.forEach(id => batchConfirmedIds.delete(id)), ttlMs);
}

// Confirm reservation: set estado to CONFIRMADA and send detailed email
app.post('/reservaciones/:id/confirmar', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r0 = await prisma.reservacion.findUnique({ where: { id }, include: { Modificaciones: true } });
    if (!r0) return res.status(404).json({ message: 'Reservación no existe' });
    if (r0.estado === 'CANCELADA') return res.status(400).json({ message: 'No se puede confirmar una reservación cancelada' });

    const updated = await prisma.reservacion.update({ where: { id }, data: { estado: 'CONFIRMADA' } });
    const seat = await prisma.asiento.findUnique({ where: { id: updated.asiento } });
    const user = await prisma.usuario.findUnique({ where: { email: updated.usuario } });

    // Send email (non-blocking) unless this id was just handled in a batch
    if (!batchConfirmedIds.has(id)) {
      sendReservationConfirmationEmail({
        to: updated.usuario,
        userName: user?.nombreCompleto,
        reservation: updated as any,
        seat: seat as any,
        modificaciones: r0.Modificaciones as any
      }).catch(() => {});
    }

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'No se pudo confirmar' });
  }
});

// Confirm multiple reservations and send a single aggregated email
app.post('/reservaciones/confirmar-lote', async (req, res) => {
  const ids: number[] = req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids required' });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const collected: Array<{ reservation: any; seat?: any; modificaciones?: any[] }> = [];
      let userEmail: string | undefined = undefined;
      let userName: string | undefined = undefined;
      for (const id of ids) {
        const r = await tx.reservacion.findUnique({ where: { id }, include: { Modificaciones: true } });
        if (!r) throw new Error(`Reservación ${id} no existe`);
        if (r.estado === 'CANCELADA') throw new Error(`Reservación ${id} está cancelada`);
        // Update status
        const updated = await tx.reservacion.update({ where: { id }, data: { estado: 'CONFIRMADA' } });
        const seat = await tx.asiento.findUnique({ where: { id: updated.asiento } });
        collected.push({ reservation: updated, seat, modificaciones: r.Modificaciones });
        userEmail = updated.usuario;
      }
      // fetch user name
      if (userEmail) {
        const u = await tx.usuario.findUnique({ where: { email: userEmail } });
        userName = u?.nombreCompleto;
      }
      return { collected, userEmail, userName };
    });

    // Marcar ids para suprimir correos individuales si alguien dispara /confirmar justo después
    markBatchConfirmed(ids);

    // Enviar un solo email con todas las reservas (no bloquear la respuesta)
    if (result.userEmail) {
      sendReservationsBatchConfirmationEmail(result.userEmail, result.userName, result.collected).catch(() => {});
    }

    res.json({ ok: true, updated: ids.length });
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'No se pudo confirmar lote' });
  }
});

app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
});
