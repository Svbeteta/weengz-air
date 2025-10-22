import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ApiService } from "../../services/api.service";
import { Asiento, Reservacion, Usuario } from "../../models";

@Component({
  selector: "app-xml-io",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./xml-io.component.html"
})
export class XmlIoComponent {
  resumen = "";
  processingMs: number | null = null;

  constructor(private api: ApiService) {}

  async exportar() {
    const t0 = performance.now();
    const [usuarios, asientos, reservaciones] = await Promise.all([
      this.api.getUsuarios().toPromise(),
      this.api.getAsientos().toPromise(),
      this.api.getReservaciones().toPromise()
    ]) as [Usuario[], Asiento[], Reservacion[]];

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<SistemaReservasAvion>
  <Usuarios>
${usuarios.map(u => `    <Usuario email="${u.email}" esVip="${u.esVip}">
      <nombreCompleto>${u.nombreCompleto}</nombreCompleto>
      <fechaCreacion>${new Date(u.fechaCreacion).toLocaleString("es-GT")}</fechaCreacion>
    </Usuario>`).join("\n")}
  </Usuarios>
  <Asientos>
${asientos.map(a => `    <Asiento numero="${a.numero}" clase="${a.clase}" estado="${a.estado}" />`).join("\n")}
  </Asientos>
  <Reservaciones>
${reservaciones.map(r => `    <Reservacion id="${r.id}" estado="${r.estado}">
      <usuario>${r.usuario}</usuario>
      <asiento>${r.asiento}</asiento>
      <pasajero>
        <nombreCompleto>${r.pasajero.nombreCompleto}</nombreCompleto>
        <cui>${r.pasajero.cui}</cui> <tieneEquipaje>${r.pasajero.tieneEquipaje}</tieneEquipaje>
      </pasajero>
      <detalles>
        <fechaReservacion>${new Date(r.detalles.fechaReservacion).toLocaleString("es-GT")}</fechaReservacion>
        <metodoSeleccion>${r.detalles.metodoSeleccion}</metodoSeleccion>
        <precioBase>${r.detalles.precioBase.toFixed(2)}</precioBase>
        <precioTotal>${r.detalles.precioTotal.toFixed(2)}</precioTotal>
      </detalles>
      ${r.Modificaciones && r.Modificaciones.length ? `<Modificaciones>
${r.Modificaciones.map(m => `        <Modificacion>
          <fecha>${new Date(m.fecha).toLocaleString("es-GT")}</fecha>
          <recargo>${m.recargo.toFixed(2)}</recargo>
          <descripcion>${m.descripcion}</descripcion>
        </Modificacion>`).join("\n")}
      </Modificaciones>` : ``}
    </Reservacion>`).join("\n")}
  </Reservaciones>
</SistemaReservasAvion>
`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weengz-air-export.xml";
    a.click();
    URL.revokeObjectURL(url);
    const t1 = performance.now();
    this.processingMs = Math.round(t1 - t0);
    this.resumen = `Exportación completada (${usuarios.length} usuarios, ${asientos.length} asientos, ${reservaciones.length} reservaciones).`;
  }

  importar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    const t0 = performance.now();
    reader.onload = async () => {
      let ok = 0, fail = 0;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(reader.result as string, "application/xml");
        const usuarios = Array.from(doc.querySelectorAll("Usuarios > Usuario"));
        const asientos = Array.from(doc.querySelectorAll("Asientos > Asiento"));
        const reservaciones = Array.from(doc.querySelectorAll("Reservaciones > Reservacion"));

        const uList = await this.api.getUsuarios().toPromise() as Usuario[];
        const aList = await this.api.getAsientos().toPromise() as Asiento[];
        const rList = await this.api.getReservaciones().toPromise() as Reservacion[];

        for (const u of usuarios) {
          try {
            const email = u.getAttribute("email")!;
            const esVip = u.getAttribute("esVip") === "true";
            const nombreCompleto = u.querySelector("nombreCompleto")?.textContent ?? "";
            const existing = uList.find(x => x.email === email);
            if (existing) {
              await this.api.actualizarUsuario(existing.id!, { nombreCompleto, esVip }).toPromise();
            } else {
              await this.api.crearUsuario({ email, esVip, nombreCompleto, fechaCreacion: new Date().toISOString() } as any).toPromise();
            }
            ok++;
          } catch { fail++; }
        }
        for (const a of asientos) {
          try {
            const numero = a.getAttribute("numero")!;
            const estado = (a.getAttribute("estado") as any) ?? "Libre";
            const existing = aList.find(x => x.numero === numero);
            if (existing) {
              await this.api.actualizarAsiento(existing.id, { estado }).toPromise();
            }
            ok++;
          } catch { fail++; }
        }
        for (const r of reservaciones) {
          try {
            const id = parseInt(r.getAttribute("id") ?? "0", 10);
            if (!rList.find(x => x.id === id)) {
              // omitir altas para mantener integridad simple con json-server
            }
            ok++;
          } catch { fail++; }
        }

        const t1 = performance.now();
        this.processingMs = Math.round(t1 - t0);
        this.resumen = `Importación terminada. Éxitos: ${ok}, Fallos: ${fail}.`;
      } catch (e) {
        this.resumen = "Error al procesar XML.";
      }
    };
    reader.readAsText(file);
  }
}