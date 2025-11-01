import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { Reservacion, Usuario, Asiento, Cabina } from "../../models";
import { AuthService } from "../../services/auth.service";
import { validarCUI } from "../../utils/cui";
import { ToastrService } from "ngx-toastr";
import dayjs from "dayjs";

@Component({
  selector: "app-reservations",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./reservations.component.html"
})
export class ReservationsComponent implements OnInit {
  usuario: Usuario | null = null;
  lote: { asientos: string[]; clase: "Negocios" | "Economica"; metodo: "Manual" | "Aleatorio"; precioBase: number } | null = null;
  pasajeros: { nombreCompleto: string; cui: string; tieneEquipaje: boolean }[] = [];
  misReservas: Reservacion[] = [];
  asientos: Asiento[] = [];

  // Pagination for "Mis Reservas"
  pageSize = 2;
  pageIndex = 0;

  // Cancel modal state
  showCancelModal = false;
  rParaCancelar: Reservacion | null = null;
  cancelCuiInput: string = '';
  showExpectedCancelCui = false;

  // Modal de modificación
  showModifyModal = false;
  rEnEdicion: Reservacion | null = null;
  targetClase: Cabina | null = null;
  selectedSeat: string | null = null;
  modifyCuiInput: string = '';
  showExpectedModifyCui = false;
  businessRows = ["I","G","F","D","C","A"];
  economyRows  = ["I","H","G","F","E","D","C","B","A"];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastrService
  ){}

  ngOnInit() {
    this.usuario = this.auth.currentUser;
    const raw = sessionStorage.getItem("weengz_reserva_lote");
    this.lote = raw ? JSON.parse(raw) : null;
    if (this.lote) {
      this.pasajeros = this.lote.asientos.map(() => ({ nombreCompleto: "", cui: "", tieneEquipaje: false }));
    }
    this.loadMine();
    this.api.getAsientos().subscribe(as => this.asientos = as);
  }

  get totalConfirmado(): number {
    return (this.misReservas || [])
      .filter(r => r.estado === 'CONFIRMADA')
      .reduce((sum, r) => sum + Number(r.detalles?.precioTotal ?? 0), 0);
  }

  get hasActivas(): boolean {
    return (this.misReservas || []).some(r => r.estado === 'ACTIVA');
  }

  // Calculate discount info: detect if a VIP discount was applied by comparing
  // precioBase against the price before modifications (precioTotal - recargos).
  discountInfo(r: any) {
    const precioBase = Number(r.detalles?.precioBase ?? 0);
    const precioTotal = Number(r.detalles?.precioTotal ?? 0);
    const recargos = (r.Modificaciones || []).reduce((s: number, m: any) => s + Number(m.recargo ?? 0), 0);
    const precioAntesRecargos = Number((precioTotal - recargos).toFixed(2));
    const applied = precioBase > precioAntesRecargos + 0.001; // allow tiny float epsilon
    const descuentoAmount = applied ? Number((precioBase - precioAntesRecargos).toFixed(2)) : 0;
    const descuentoPct = precioBase > 0 ? Number(((descuentoAmount / precioBase) * 100).toFixed(0)) : 0;
    return { applied, descuentoAmount, descuentoPct, precioBase, precioAntesRecargos, recargos, precioTotal };
  }

  get hasPendientes(): boolean {
    return (this.misReservas || []).some(r => r.estado === 'ACTIVA');
  }

  loadMine() {
    if (!this.usuario) return;
    this.api.getReservasPorUsuario(this.usuario.email).subscribe(r => {
      // Sort newest to oldest by reservation date, fallback to id desc
      const sorted = (r || []).slice().sort((a: any, b: any) => {
        const da = a?.detalles?.fechaReservacion ? new Date(a.detalles.fechaReservacion).getTime() : 0;
        const db = b?.detalles?.fechaReservacion ? new Date(b.detalles.fechaReservacion).getTime() : 0;
        if (db !== da) return db - da;
        // fallback by id desc
        return (b.id || 0) - (a.id || 0);
      });
      this.misReservas = sorted as any;
      // Clamp page index when data changes
      const tp = this.totalPages;
      if (tp === 0) {
        this.pageIndex = 0;
      } else if (this.pageIndex > tp - 1) {
        this.pageIndex = tp - 1;
      }
    });
  }

  confirmarLote() {
    if (!this.usuario || !this.lote) return;
    for (let i=0;i<this.pasajeros.length;i++) {
      const p = this.pasajeros[i];
      if (!p.nombreCompleto || !p.cui) {
        this.toast.error("Complete los datos de todos los pasajeros.");
        return;
      }
      const v = validarCUI(p.cui);
      if (!v.ok) {
        this.toast.error(`CUI inválido en pasajero ${i+1}: ${v.error}`);
        return;
      }
    }
    const ahora = dayjs().toISOString();
    const vip = (this.usuario.esVip || (this.usuario.reservasCount ?? 0) >= 5);
    const descuento = vip ? 0.1 : 0;
    const precioBase = this.lote.precioBase;

    const crear = this.lote.asientos.map((num, idx) => {
      // Delegamos cálculo de VIP/descuento y cambios de estado al servidor
      const payload = {
        usuario: this.usuario!.email,
        asiento: num,
        pasajero: this.pasajeros[idx],
        detalles: {
          fechaReservacion: ahora,
          metodoSeleccion: this.lote!.metodo,
          precioBase
        }
      };
      return this.api.crearReservacionAtomica(payload);
    });

    let chain = Promise.resolve();
    crear.forEach(req => {
      chain = chain.then(() => new Promise<void>((resolve) => {
        req.subscribe(() => resolve());
      }));
    });
    chain.then(() => {
      this.toast.success("Asientos reservados");
      // Actualizamos sesión de usuario desde backend (en caso de VIP/counter)
      if (this.usuario?.id) {
        this.api.getUsuarioPorEmail(this.usuario.email).subscribe(u => {
          if (u) {
            this.auth.currentUser = u;
            this.usuario = u;
          }
          this.loadMine();
          sessionStorage.removeItem("weengz_reserva_lote");
        });
      } else {
        this.loadMine();
        sessionStorage.removeItem("weengz_reserva_lote");
      }
    });
  }

  abrirCancelar(r: Reservacion) {
    this.rParaCancelar = r;
    this.showCancelModal = true;
    this.cancelCuiInput = '';
  }

  confirmCancelFromModal() {
    if (!this.rParaCancelar?.id) {
      this.showCancelModal = false;
      this.rParaCancelar = null;
      return;
    }
    const seat = this.rParaCancelar.asiento;
  this.api.cancelarReservacionAtomica(this.rParaCancelar.id, this.cancelCuiInput).subscribe({
      next: () => {
        this.toast.info(
          `Tu reservación del asiento ${seat} fue cancelada. Enviamos un correo con el detalle.`,
          'Reservación cancelada',
          { closeButton: true, progressBar: true, timeOut: 12000, extendedTimeOut: 4000, tapToDismiss: false }
        );
        this.showCancelModal = false;
        this.rParaCancelar = null;
        this.loadMine();
      },
      error: (e) => {
        const msg = e?.error?.message || 'No se pudo cancelar la reservación';
        this.toast.error(msg);
        this.showCancelModal = false;
        this.rParaCancelar = null;
      }
    });
  }

  cancelCancelModal() {
    this.showCancelModal = false;
    this.rParaCancelar = null;
  }

  modificar(r: Reservacion) {
    // Abrir modal con diagrama
    this.rEnEdicion = r;
    if (!this.asientos.length) {
      this.api.getAsientos().subscribe(as => {
        this.asientos = as;
        this.openModifyModalContext();
      });
    } else {
      this.openModifyModalContext();
    }
  }

  confirmarReserva(r: Reservacion) { this.confirmar(r); }

  confirmar(r: Reservacion) {
    if (!r.id) return;
    this.api.confirmarReservacion(r.id).subscribe({
      next: (upd) => {
        this.toast.success(`Reserva #${upd.id} confirmada. Email enviado.`);
        this.loadMine();
      },
      error: (e) => {
        const msg = e?.error?.message || 'No se pudo confirmar la reservación';
        this.toast.error(msg);
      }
    });
  }

  confirmarTodas() {
    const pendientes = (this.misReservas || []).filter(r => r.estado === 'ACTIVA');
    if (!pendientes.length) {
      this.toast.info('No hay reservas pendientes para confirmar.');
      return;
    }
    const ids = pendientes.map(p => p.id!).filter(Boolean) as number[];
    this.api.confirmarReservacionesLote(ids).subscribe({
      next: (res) => {
        this.toast.success(
          'Te enviamos un correo con el detalle consolidado de tus reservaciones. Revisa tu bandeja de entrada.',
          '¡Confirmación enviada!',
          { closeButton: true, progressBar: true, timeOut: 12000, extendedTimeOut: 4000, tapToDismiss: false }
        );
        this.loadMine();
      },
      error: (e) => {
        const msg = e?.error?.message || 'No se pudo confirmar el lote de reservaciones';
        this.toast.error(msg);
      }
    });
  }

  // Pagination helpers
  get totalItems(): number {
    return (this.misReservas || []).length;
  }
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }
  get pagedReservas(): Reservacion[] {
    const start = this.pageIndex * this.pageSize;
    return (this.misReservas || []).slice(start, start + this.pageSize);
  }
  get pageStart(): number {
    if (this.totalItems === 0) return 0;
    return (this.pageIndex * this.pageSize) + 1;
  }
  get pageEnd(): number {
    if (this.totalItems === 0) return 0;
    const end = (this.pageIndex * this.pageSize) + this.pageSize;
    return Math.min(end, this.totalItems);
  }
  prevPage() {
    if (this.pageIndex > 0) this.pageIndex--;
  }
  nextPage() {
    if (this.pageIndex < this.totalPages - 1) this.pageIndex++;
  }

  private openModifyModalContext() {
    const current = this.asientos.find(a => a.numero === this.rEnEdicion!.asiento);
    this.targetClase = (current?.clase ?? 'Economica') as Cabina;
    this.selectedSeat = null;
    this.showModifyModal = true;
    this.modifyCuiInput = '';
  }

  seatsByRow(row: string, clase: Cabina) {
    return this.asientos
      .filter(a => a.clase === clase && a.numero.startsWith(row))
      .sort((a,b) => a.numero.localeCompare(b.numero));
  }

  pickSeat(a: Asiento) {
    if (a.estado === 'Ocupado') return;
    if (this.targetClase && a.clase !== this.targetClase) return;
    this.selectedSeat = a.numero;
  }

  confirmModifyFromModal() {
    if (!this.rEnEdicion || !this.selectedSeat || this.selectedSeat === this.rEnEdicion.asiento) {
      this.showModifyModal = false; return;
    }
    this.api.modificarReservacionAtomica(this.rEnEdicion.id!, this.selectedSeat, `Cambio de ${this.rEnEdicion.asiento} a ${this.selectedSeat}.`, this.modifyCuiInput).subscribe(() => {
      this.toast.success("Reserva modificada (10% recargo aplicado). Email enviado (simulado).");
      this.showModifyModal = false;
      this.rEnEdicion = null;
      this.selectedSeat = null;
      this.loadMine();
      // refrescar asientos para reflejar ocupación
      this.api.getAsientos().subscribe(as => this.asientos = as);
    });
  }

  cancelModifyModal() {
    this.showModifyModal = false;
    this.rEnEdicion = null;
    this.selectedSeat = null;
  }

  // UI validation helpers
  private normalizeCui(s: string | undefined | null): string { return (s || '').replace(/\D/g, ''); }
  get isCancelCuiValid(): boolean {
    if (!this.rParaCancelar) return false;
    return this.normalizeCui(this.cancelCuiInput) === this.normalizeCui(this.rParaCancelar.pasajero?.cui);
  }
  get isModifyCuiValid(): boolean {
    if (!this.rEnEdicion) return false;
    return this.normalizeCui(this.modifyCuiInput) === this.normalizeCui(this.rEnEdicion.pasajero?.cui);
  }

  // Input sanitizers to avoid regex literals in template parser
  onModifyCuiChange(v: string) {
    // allow digits and spaces only (keeps visual grouping)
    this.modifyCuiInput = (v || '').replace(/[^0-9\s]/g, '');
  }
  onCancelCuiChange(v: string) {
    this.cancelCuiInput = (v || '').replace(/[^0-9\s]/g, '');
  }
}