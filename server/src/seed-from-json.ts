import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const file = path.resolve(__dirname, '../../db.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Seed usuarios
  for (const u of json.usuarios ?? []) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {
        nombreCompleto: u.nombreCompleto,
        esVip: u.esVip,
        reservasCount: u.reservasCount ?? 0,
        fechaCreacion: new Date(u.fechaCreacion),
      },
      create: {
        email: u.email,
        nombreCompleto: u.nombreCompleto,
        esVip: u.esVip,
        reservasCount: u.reservasCount ?? 0,
        fechaCreacion: new Date(u.fechaCreacion),
      }
    });
  }

  // Seed asientos
  for (const a of json.asientos ?? []) {
    await prisma.asiento.upsert({
      where: { id: a.id },
      update: { estado: a.estado, clase: a.clase, numero: a.numero },
      create: { id: a.id, estado: a.estado, clase: a.clase, numero: a.numero }
    });
  }

  // Seed reservaciones
  for (const r of json.reservaciones ?? []) {
    const created = await prisma.reservacion.create({ data: {
      estado: r.estado,
      usuario: r.usuario,
      asiento: r.asiento,
      pasajeroNombre: r.pasajero?.nombreCompleto,
      pasajeroCui: r.pasajero?.cui,
      pasajeroEquipaje: !!r.pasajero?.tieneEquipaje,
      fechaReservacion: new Date(r.detalles?.fechaReservacion ?? new Date()),
      metodoSeleccion: r.detalles?.metodoSeleccion ?? 'Manual',
      precioBase: Number(r.detalles?.precioBase ?? 0),
      precioTotal: Number(r.detalles?.precioTotal ?? 0),
    }});

    for (const m of r.Modificaciones ?? []) {
      await prisma.modificacion.create({ data: {
        descripcion: m.descripcion,
        recargo: Number(m.recargo ?? 0),
        fecha: new Date(m.fecha ?? new Date()),
        reservacionId: created.id,
      }});
    }
  }

  console.log('Seed done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
