import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { Asiento, Cabina, Usuario } from "../../models";
import { AuthService } from "../../services/auth.service";
import { ToastrService } from "ngx-toastr";

type Metodo = "Manual" | "Aleatorio";

@Component({
  selector: "app-seats",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./seats.component.html"
})
export class SeatsComponent implements OnInit {
  usuario: Usuario | null = null;
  asientos: Asiento[] = [];
  clase: Cabina = "Economica";
  cantidad = 1;
  metodo: Metodo = "Manual";
  seleccionados = new Set<string>();

  precios: Record<Cabina, number> = { Negocios: 550, Economica: 250 };
  businessRows = ["I","G","F","D","C","A"];
  economyRows  = ["I","H","G","F","E","D","C","B","A"];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastrService
  ) {}

  ngOnInit() {
    this.usuario = this.auth.currentUser;
    this.load();
  }

  get isLogged(): boolean { return !!this.usuario; }

  load() {
    this.api.getAsientos().subscribe(as => {
      this.asientos = as;
      this.seleccionados.clear();
    });
  }

  seatsByRow(row: string, clase: Cabina) {
    return this.asientos
      .filter(a => a.clase === clase && a.numero.startsWith(row))
      .sort((a,b) => a.numero.localeCompare(b.numero));
  }

  toggleSeat(a: Asiento) {
    if (this.metodo === "Aleatorio") return;
    if (a.estado === "Ocupado") return;
    if (this.seleccionados.has(a.numero)) this.seleccionados.delete(a.numero);
    else {
      if (this.seleccionados.size >= this.cantidad) {
        this.toast.warning("Ya alcanzó la cantidad seleccionada.");
        return;
      }
      this.seleccionados.add(a.numero);
    }
  }

  randomPick() {
    const libres = this.asientos.filter(a => a.clase === this.clase && a.estado === "Libre");
    if (libres.length < this.cantidad) {
      this.toast.error("No hay suficientes asientos libres.");
      return;
    }
    this.seleccionados.clear();
    while (this.seleccionados.size < this.cantidad) {
      const idx = Math.floor(Math.random() * libres.length);
      this.seleccionados.add(libres[idx].numero);
    }
  }

  avanzar() {
    if (!this.isLogged) {
      this.toast.error("Debe iniciar sesión para reservar.");
      location.href = "/login";
      return;
    }
    if (this.metodo === "Manual" && this.seleccionados.size !== this.cantidad) {
      this.toast.warning("Seleccione la cantidad indicada de asientos.");
      return;
    }
    if (this.metodo === "Aleatorio") this.randomPick();
    sessionStorage.setItem("weengz_reserva_lote", JSON.stringify({
      asientos: Array.from(this.seleccionados.values()),
      clase: this.clase,
      metodo: this.metodo,
      precioBase: this.precios[this.clase]
    }));
    location.href = "/reservations";
  }
}