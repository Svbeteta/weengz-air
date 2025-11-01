export type Cabina = "Negocios" | "Economica";

export interface Usuario {
  id?: number;
  email: string;
  nombreCompleto: string;
  fechaCreacion: string; // ISO
  esVip: boolean;
  reservasCount?: number;
}

export interface Asiento {
  id: string;
  numero: string; // p.ej. A1
  clase: Cabina;
  estado: "Libre" | "Ocupado";
}

export interface Modificacion {
  fecha: string; // ISO
  recargo: number;
  descripcion: string;
}

export interface Pasajero {
  nombreCompleto: string;
  cui: string;
  tieneEquipaje: boolean;
}

export interface DetallesReserva {
  fechaReservacion: string; // ISO
  metodoSeleccion: "Manual" | "Aleatorio";
  precioBase: number;
  precioTotal: number;
}

export interface Reservacion {
  id?: number;
  estado: "ACTIVA" | "CONFIRMADA" | "CANCELADA";
  usuario: string; // email
  asiento: string; // numero de asiento
  pasajero: Pasajero;
  detalles: DetallesReserva;
  Modificaciones?: Modificacion[];
}

export interface ReporteResumen {
  usuariosCreados: number;
  reservasPorUsuario: Record<string, number>;
  ocupadosPorClase: Record<Cabina, number>;
  libresPorClase: Record<Cabina, number>;
  seleccionManual: number;
  seleccionAleatorio: number;
  modificados: number;
  cancelados: number;
}
