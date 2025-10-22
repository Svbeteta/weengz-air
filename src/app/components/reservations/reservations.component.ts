import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { Reservacion, Usuario } from "../../models";
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
  }

  loadMine() {
    if (!this.usuario) return;
    this.api.getReservasPorUsuario(this.usuario.email).subscribe(r => this.misReservas = r);
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
      const precioTotal = +(precioBase * (1 - descuento)).toFixed(2);
      const r: Reservacion = {
        estado: "ACTIVA",
        usuario: this.usuario!.email,
        asiento: num,
        pasajero: this.pasajeros[idx],
        detalles: {
          fechaReservacion: ahora,
          metodoSeleccion: this.lote!.metodo,
          precioBase,
          precioTotal
        },
        Modificaciones: []
      };
      return this.api.crearReservacion(r);
    });

    let chain = Promise.resolve();
    crear.forEach(req => {
      chain = chain.then(() => new Promise<void>((resolve) => {
        req.subscribe(() => resolve());
      }));
    });
    chain.then(() => {
      this.api.getAsientos().subscribe(as => {
        const tasks = as.filter(a => this.lote!.asientos.includes(a.numero))
          .map(a => this.api.actualizarAsiento(a.id, { estado: "Ocupado" }));
        let ch = Promise.resolve();
        tasks.forEach(t => ch = ch.then(() => new Promise<void>(res => t.subscribe(() => res()))));
        ch.then(() => {
          this.toast.success("Reservas creadas. Se envió email con detalle (simulado).");
          if (this.usuario?.id) {
            const newCount = (this.usuario.reservasCount ?? 0) + this.lote!.asientos.length;
            const becameVip = newCount >= 5;
            this.api.actualizarUsuario(this.usuario.id, { reservasCount: newCount, esVip: (this.usuario.esVip || becameVip) })
              .subscribe(u => {
                this.auth.currentUser = u;
                this.usuario = u;
                this.loadMine();
                sessionStorage.removeItem("weengz_reserva_lote");
              });
          }
        });
      });
    });
  }

  cancelar(r: Reservacion) {
    if (!confirm(`Cancelar la reservación del asiento ${r.asiento}?`)) return;
    this.api.actualizarReservacion(r.id!, { estado: "CANCELADA" }).subscribe(() => {
      this.api.actualizarAsiento(r.asiento, { estado: "Libre" }).subscribe(() => {
        this.toast.info("Reserva cancelada. Se envió email de confirmación (simulado).");
        this.loadMine();
      });
    });
  }

  modificar(r: Reservacion) {
    const nuevo = prompt(`Modificar reserva ${r.asiento} - Ingrese nuevo asiento (${r.asiento[0]} misma clase):`, r.asiento);
    if (!nuevo || nuevo === r.asiento) return;
    this.api.getAsientos().subscribe(as => {
      const old = as.find(a => a.numero === r.asiento)!;
      const target = as.find(a => a.numero === nuevo);
      if (!target) { this.toast.error("Asiento no existe."); return; }
      if (target.clase !== old.clase) { this.toast.error("Debe ser el mismo tipo/clase de asiento."); return; }
      if (target.estado === "Ocupado") { this.toast.error("Asiento destino ocupado."); return; }

      const recargo = +(r.detalles.precioBase * 0.10).toFixed(2);
      const nuevoPrecio = +(r.detalles.precioTotal + recargo).toFixed(2);
      const mod = { fecha: dayjs().toISOString(), recargo, descripcion: `Cambio de ${r.asiento} a ${target.numero}.` };
      const mods = (r.Modificaciones ?? []).concat([mod]);

      this.api.actualizarReservacion(r.id!, {
        asiento: target.numero,
        detalles: { ...r.detalles, precioTotal: nuevoPrecio },
        Modificaciones: mods
      }).subscribe(() => {
        this.api.actualizarAsiento(r.asiento, { estado: "Libre" }).subscribe(() => {
          this.api.actualizarAsiento(target.id, { estado: "Ocupado" }).subscribe(() => {
            this.toast.success("Reserva modificada (10% recargo aplicado). Email enviado (simulado).");
            this.loadMine();
          });
        });
      });
    });
  }
}