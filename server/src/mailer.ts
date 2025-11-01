import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'no-reply@weengz.local';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const logoPathEnv = process.env.LOGO_PATH; // Optional override
const defaultLogoPath = path.resolve(__dirname, '../../public/logo.png');
const logoPathResolved = logoPathEnv ? path.resolve(logoPathEnv) : defaultLogoPath;

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function createTransporter() {
  // If credentials provided, use them
  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: { user: smtpUser, pass: smtpPass }
    });
  }
  // Dev fallback: use Ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  return t;
}

export async function getTransporter() {
  if (!transporterPromise) transporterPromise = createTransporter();
  return transporterPromise;
}

function brandTemplate(params: { title: string; greeting?: string; paragraphs: string[]; cta?: { label: string; href: string }; footerNote?: string; logoCid?: string }) {
  const colors = {
    bg: '#f5f7fb',
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    muted: '#6b7280',
    primary: '#3b82f6'
  };
  const { title, greeting, paragraphs, cta, footerNote, logoCid } = params;
  const btn = cta
    ? `<a href="${cta.href}"
          style="background:${colors.primary};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;display:inline-block;font-weight:600;">
          ${cta.label}
       </a>`
    : '';
  const body = paragraphs.map(p => `<p style=\"margin:0 0 12px;color:#374151;line-height:1.6\">${p}</p>`).join('');
  return `
  <div style="margin:0;padding:24px;background:${colors.bg};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:${colors.surface};border:1px solid ${colors.border};border-radius:14px;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:20px 24px;background:${colors.surface};">
                ${logoCid
                  ? `<img src="cid:${logoCid}" alt="Weengz Air" width="112" style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:112px">`
                  : `<div style=\"font-size:18px;font-weight:700;color:${colors.text};letter-spacing:0.2px\">Weengz Air</div>`}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 4px">
                <h2 style="margin:0 0 8px;color:${colors.text};font-size:20px">${title}</h2>
                ${greeting ? `<p style=\"margin:0 0 8px;color:#374151\">${greeting}</p>` : ''}
                ${body}
                ${cta ? `<div style=\"margin:16px 0 8px\">${btn}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;border-top:1px solid ${colors.border}">
                <small style="color:${colors.muted}">${footerNote || 'Este es un correo automático, por favor no respondas.'}</small>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

export async function sendUserCreatedEmail(to: string, name: string) {
  try {
    const transporter = await getTransporter();
    const loginUrl = `${frontendUrl}/login`;
    const subject = 'Bienvenido a Weengz Air';
    const logoExists = fs.existsSync(logoPathResolved);
    const logoCid = logoExists ? 'logo@weengz' : undefined;
    const html = brandTemplate({
      title: '¡Cuenta creada con éxito!',
      greeting: `Hola ${name || 'viajero'},`,
      paragraphs: [
        'Confirmamos la creación de tu cuenta en <strong>Weengz Air</strong>. Ya puedes iniciar sesión y reservar tus asientos.',
        'Si no fuiste tú, ignora este mensaje.'
      ],
      cta: { label: 'Iniciar sesión', href: loginUrl },
      footerNote: 'Este es un correo automático, por favor no respondas.',
      logoCid
    });
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: `Cuenta creada con éxito\n\nHola ${name || 'viajero'},\n\nConfirmamos la creación de tu cuenta en Weengz Air. Ya puedes iniciar sesión y reservar tus asientos.\n\nIniciar sesión: ${loginUrl}\n\nSi no fuiste tú, ignora este mensaje.`
      ,
      attachments: logoExists ? [{ filename: 'logo.png', path: logoPathResolved, cid: logoCid! }] : undefined
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log('Email de confirmación (preview):', preview);
    }
  } catch (err) {
    console.warn('No se pudo enviar el email de confirmación:', (err as Error).message);
  }
}

export async function sendReservationConfirmationEmail(params: {
  to: string;
  userName?: string;
  reservation: {
    id: number;
    estado: string;
    usuario: string;
    asiento: string;
    pasajeroNombre: string;
    pasajeroCui: string;
    pasajeroEquipaje: boolean;
    fechaReservacion: Date | string;
    metodoSeleccion: string;
    precioBase: number;
    precioTotal: number;
  };
  seat?: { id: string; numero: string; clase: string } | null;
  modificaciones?: Array<{ fecha: Date | string; recargo: number; descripcion: string }>;    
}) {
  const { to, userName, reservation, seat, modificaciones } = params;
  try {
    const transporter = await getTransporter();
      const fmt = (d: any) => new Date(d).toLocaleString();

      // Calculate recargos sum from modificaciones (if any) and detect discount
      const recargosTotal = (modificaciones || []).reduce((s, m) => s + Number(m.recargo ?? 0), 0);
      const precioBase = Number(reservation.precioBase ?? 0);
      const precioTotal = Number(reservation.precioTotal ?? 0);
      const precioAntesRecargos = Number((precioTotal - recargosTotal).toFixed(2));
      const discountApplied = precioBase > precioAntesRecargos + 0.001;
      const discountAmount = discountApplied ? Number((precioBase - precioAntesRecargos).toFixed(2)) : 0;
      const discountPct = precioBase > 0 ? Math.round((discountAmount / precioBase) * 100) : 0;

      const lines: string[] = [];
      lines.push(`<strong>Reserva #${reservation.id}</strong>`);
      lines.push(`Estado: <strong>${reservation.estado}</strong>`);
      if (seat) lines.push(`Asiento: <strong>${seat.numero}</strong> (${seat.clase})`);
      lines.push(`Pasajero: ${reservation.pasajeroNombre} — CUI: ${reservation.pasajeroCui}`);
      lines.push(`Equipaje: ${reservation.pasajeroEquipaje ? 'Sí' : 'No'}`);
      lines.push(`Fecha: ${fmt(reservation.fechaReservacion)}`);
      lines.push(`Método de selección: ${reservation.metodoSeleccion}`);
      lines.push(`Precio original: Q${precioBase.toFixed(2)}`);
      if (discountApplied) lines.push(`Descuento aplicado: -Q${discountAmount.toFixed(2)} (${discountPct}%)`);
      if (recargosTotal > 0) lines.push(`Recargos por modificaciones: +Q${recargosTotal.toFixed(2)}`);
      lines.push(`<strong>Total pagado: Q${precioTotal.toFixed(2)}</strong>`);

    const modsHtml = (modificaciones && modificaciones.length)
      ? `<div style="margin-top:12px">
          <div style="font-weight:600;color:#111827;margin-bottom:6px">Modificaciones</div>
          <ul style="margin:0;padding-left:18px;color:#374151">
            ${modificaciones.map(m => `<li>${fmt(m.fecha)} — ${m.descripcion} (Recargo: Q${m.recargo.toFixed(2)})</li>`).join('')}
          </ul>
        </div>`
      : '';

    const subject = `Confirmación de reserva #${reservation.id}`;
    const html = brandTemplate({
      title: '¡Tu reservación fue confirmada!',
      greeting: `Hola ${userName || 'viajero'},`,
      paragraphs: [lines.join('<br/>')],
      cta: { label: 'Ver mis asientos', href: `${frontendUrl}/seats` },
      footerNote: 'Gracias por volar con Weengz Air.' ,
      logoCid: fs.existsSync(logoPathResolved) ? 'logo@weengz' : undefined
    }).replace('</td>\n            </tr>', `${modsHtml}</td>\n            </tr>`);

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: `Reserva #${reservation.id} confirmada\nEstado: ${reservation.estado}\nAsiento: ${seat?.numero ?? reservation.asiento} (${seat?.clase ?? ''})\nPasajero: ${reservation.pasajeroNombre} — CUI: ${reservation.pasajeroCui}\nEquipaje: ${reservation.pasajeroEquipaje ? 'Sí' : 'No'}\nFecha: ${fmt(reservation.fechaReservacion)}\nMétodo: ${reservation.metodoSeleccion}\nPrecio base: Q${reservation.precioBase.toFixed(2)}\nTotal: Q${reservation.precioTotal.toFixed(2)}`,
      attachments: fs.existsSync(logoPathResolved) ? [{ filename: 'logo.png', path: logoPathResolved, cid: 'logo@weengz' }] : undefined
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email de confirmación de reserva (preview):', preview);
  } catch (err) {
    console.warn('No se pudo enviar la confirmación de reserva:', (err as Error).message);
  }
}


export async function sendReservationCancellationEmail(params: {
  to: string;
  userName?: string;
  reservation: {
    id: number;
    estado: string;
    usuario: string;
    asiento: string;
    pasajeroNombre: string;
    pasajeroCui: string;
    pasajeroEquipaje: boolean;
    fechaReservacion: Date | string;
    metodoSeleccion: string;
    precioBase: number;
    precioTotal: number;
  };
  seat?: { id: string; numero: string; clase: string } | null;
  modificaciones?: Array<{ fecha: Date | string; recargo: number; descripcion: string }>;    
}) {
  const { to, userName, reservation, seat, modificaciones } = params;
  try {
    const transporter = await getTransporter();
    const fmt = (d: any) => new Date(d).toLocaleString();

    const recargosTotal = (modificaciones || []).reduce((s, m) => s + Number(m.recargo ?? 0), 0);
    const precioBase = Number(reservation.precioBase ?? 0);
    const precioTotal = Number(reservation.precioTotal ?? 0);
    const precioAntesRecargos = Number((precioTotal - recargosTotal).toFixed(2));
    const discountApplied = precioBase > precioAntesRecargos + 0.001;
    const discountAmount = discountApplied ? Number((precioBase - precioAntesRecargos).toFixed(2)) : 0;
    const discountPct = precioBase > 0 ? Math.round((discountAmount / precioBase) * 100) : 0;

    const lines: string[] = [];
    lines.push(`<strong>Reserva #${reservation.id}</strong>`);
    lines.push(`Estado: <strong>${reservation.estado}</strong>`);
    if (seat) lines.push(`Asiento: <strong>${seat.numero}</strong> (${seat.clase})`);
    lines.push(`Pasajero: ${reservation.pasajeroNombre} — CUI: ${reservation.pasajeroCui}`);
    lines.push(`Equipaje: ${reservation.pasajeroEquipaje ? 'Sí' : 'No'}`);
    lines.push(`Fecha: ${fmt(reservation.fechaReservacion)}`);
    lines.push(`Método de selección: ${reservation.metodoSeleccion}`);
    lines.push(`Precio original: Q${precioBase.toFixed(2)}`);
    if (discountApplied) lines.push(`Descuento aplicado: -Q${discountAmount.toFixed(2)} (${discountPct}%)`);
    if (recargosTotal > 0) lines.push(`Recargos por modificaciones: +Q${recargosTotal.toFixed(2)}`);
    lines.push(`<strong>Total pagado: Q${precioTotal.toFixed(2)}</strong>`);

    const subject = `Cancelación de reserva #${reservation.id}`;
    const html = brandTemplate({
      title: 'Reservación cancelada',
      greeting: `Hola ${userName || 'viajero'},`,
      paragraphs: [lines.join('<br/>'), 'Tu asiento ha sido liberado y la reservación ha sido cancelada. Si corresponde, revisa el estado de reembolso en tu cuenta.'],
      cta: { label: 'Ver mis reservas', href: `${frontendUrl}/reservations` },
      footerNote: 'Si no solicitaste esta cancelación, contacta soporte.' ,
      logoCid: fs.existsSync(logoPathResolved) ? 'logo@weengz' : undefined
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: `Reserva #${reservation.id} cancelada. Total: Q${precioTotal.toFixed(2)}.`,
      attachments: fs.existsSync(logoPathResolved) ? [{ filename: 'logo.png', path: logoPathResolved, cid: 'logo@weengz' }] : undefined
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email de cancelación de reserva (preview):', preview);
  } catch (err) {
    console.warn('No se pudo enviar el email de cancelación de reserva:', (err as Error).message);
  }
}

// Envío de confirmación en lote: un solo correo con todas las reservas
export async function sendReservationsBatchConfirmationEmail(to: string, userName: string | undefined, reservations: Array<{ reservation: any; seat?: any; modificaciones?: any[] }>) {
  try {
    const transporter = await getTransporter();
    const fmt = (d: any) => new Date(d).toLocaleString();

    // Construir bloques por reserva al mismo estilo que el correo individual
    const sectionsHtml = reservations.map(r => {
      const res = r.reservation;
      const seat = r.seat;
      const mods = r.modificaciones || [];
      const recargosTotal = mods.reduce((s: number, m: any) => s + Number(m.recargo ?? 0), 0);
      const precioBase = Number(res.precioBase ?? 0);
      const precioTotal = Number(res.precioTotal ?? 0);
      const precioAntesRecargos = Number((precioTotal - recargosTotal).toFixed(2));
      const discountApplied = precioBase > precioAntesRecargos + 0.001;
      const discountAmount = discountApplied ? Number((precioBase - precioAntesRecargos).toFixed(2)) : 0;
      const discountPct = precioBase > 0 ? Math.round((discountAmount / precioBase) * 100) : 0;

      const priceLines: string[] = [];
      priceLines.push(`Precio original: Q${precioBase.toFixed(2)}`);
      if (discountApplied) priceLines.push(`Descuento: -Q${discountAmount.toFixed(2)} (${discountPct}%)`);
      if (recargosTotal > 0) priceLines.push(`Recargos: +Q${recargosTotal.toFixed(2)}`);
      priceLines.push(`<strong>Total: Q${precioTotal.toFixed(2)}</strong>`);

      const modsHtml = mods.length
        ? `<div style="margin-top:12px">
             <div style="font-weight:600;color:#111827;margin-bottom:6px">Modificaciones:</div>
             <ul style="margin:0;padding-left:18px;color:#374151">
               ${mods.map((m: any) => `<li>${fmt(m.fecha)} — Q${m.recargo.toFixed(2)} — ${m.descripcion}</li>`).join('')}
             </ul>
           </div>`
        : '';

      return [
        `<div style="margin:12px 0 16px">`,
        `<div style="font-weight:600">Asiento ${seat?.numero ?? res.asiento} <small style=\"color:#6b7280\">${seat?.clase ?? ''}</small></div>`,
        `<div style=\"color:#374151\">Pasajero: ${res.pasajeroNombre} — CUI: ${res.pasajeroCui} — ${res.pasajeroEquipaje ? 'Con equipaje' : 'Sin equipaje'}</div>`,
        `<div style=\"color:#374151\">Fecha: ${fmt(res.fechaReservacion)} • Método: ${res.metodoSeleccion}</div>`,
        `<div style=\"margin-top:6px;color:#111827\">${priceLines.join('<br/>')}</div>`,
        modsHtml,
        `</div>`
      ].join('');
    }).join('');

    const total = reservations.reduce((s, r) => s + Number(r.reservation.precioTotal ?? 0), 0);
    const subject = `Confirmación de ${reservations.length} reservación(es) - Weengz Air`;
    const logoCid = fs.existsSync(logoPathResolved) ? 'logo@weengz' : undefined;

    // Inserta las secciones dentro del cuerpo principal para que el título y saludo queden arriba
    const combinedBody = [
      `<div style=\"color:#374151\">Hemos confirmado las siguientes reservaciones:</div>`,
      sectionsHtml,
      `<div style=\"margin-top:12px;font-weight:700;color:#111827\">Total combinado: Q${total.toFixed(2)}</div>`
    ].join('');

    const html = brandTemplate({
      title: '¡Reservación(es) confirmada(s)!',
      greeting: `Hola ${userName || 'viajero'},`,
      paragraphs: [combinedBody],
      footerNote: 'Gracias por elegir Weengz Air.',
      logoCid
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: `Se confirmaron ${reservations.length} reservación(es). Total: Q${total.toFixed(2)}`,
      attachments: logoCid ? [{ filename: 'logo.png', path: logoPathResolved, cid: logoCid }] : undefined
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email de confirmación de reservas (preview):', preview);
  } catch (err) {
    console.warn('No se pudo enviar el email batch de confirmación:', (err as Error).message);
  }
}
