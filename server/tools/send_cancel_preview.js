const nodemailer = require('nodemailer');

async function main(){
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });

  const reservation = {
    id: 29,
    estado: 'CANCELADA',
    usuario: 'test+bot@example.com',
    asiento: 'A4',
    pasajeroNombre: 'Test Passenger',
    pasajeroCui: '1234567890123',
    pasajeroEquipaje: false,
    fechaReservacion: new Date().toISOString(),
    metodoSeleccion: 'Manual',
    precioBase: 100.00,
    precioTotal: 90.00
  };
  const recargos = 0;
  const precioAntesRecargos = reservation.precioTotal - recargos;
  const discountApplied = reservation.precioBase > precioAntesRecargos + 0.001;
  const discountAmount = discountApplied ? Number((reservation.precioBase - precioAntesRecargos).toFixed(2)) : 0;
  const discountPct = reservation.precioBase > 0 ? Math.round((discountAmount / reservation.precioBase) * 100) : 0;

  const html = `
    <div style="background:#f5f7fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
        <h2 style="margin-top:0;color:#111827">Reservación cancelada</h2>
        <p style="color:#374151">Hola Test Bot,</p>
        <p style="color:#374151">Se ha cancelado la siguiente reservación:</p>
        <div style="padding:10px 0">
          <div><strong>Reserva #${reservation.id}</strong></div>
          <div>Asiento: <strong>${reservation.asiento}</strong></div>
          <div>Pasajero: ${reservation.pasajeroNombre} — CUI: ${reservation.pasajeroCui}</div>
          <div>Fecha: ${new Date(reservation.fechaReservacion).toLocaleString()}</div>
          <div style="margin-top:8px">Precio original: Q${reservation.precioBase.toFixed(2)}</div>
          ${discountApplied ? `<div style="color:#0f5132">Descuento aplicado: -Q${discountAmount.toFixed(2)} (${discountPct}%)</div>` : ''}
          ${recargos > 0 ? `<div style="color:#7f1d1d">Recargos: +Q${recargos.toFixed(2)}</div>` : ''}
          <div style="margin-top:8px;font-weight:700">Total pagado: Q${reservation.precioTotal.toFixed(2)}</div>
        </div>
        <p style="color:#6b7280">Si no solicitaste esta cancelación, contacta soporte.</p>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: 'no-reply@weengz.local',
    to: reservation.usuario,
    subject: `Cancelación de reserva #${reservation.id}`,
    html,
    text: `Reserva #${reservation.id} cancelada. Total: Q${reservation.precioTotal.toFixed(2)}`
  });

  const preview = nodemailer.getTestMessageUrl(info);
  console.log('Ethereal preview URL:', preview);
}

main().catch(err => console.error(err));
