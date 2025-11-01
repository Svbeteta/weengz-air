import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Asiento, Reservacion, Usuario } from '../models';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Usuarios
  getUsuarios() {
    return this.http.get<Usuario[]>(`${this.base}/usuarios`);
  }
  crearUsuario(u: Usuario) {
    return this.http.post<Usuario>(`${this.base}/usuarios`, u);
  }
  actualizarUsuario(id: number, patch: Partial<Usuario>) {
    return this.http.patch<Usuario>(`${this.base}/usuarios/${id}`, patch);
  }

  // Asientos
  getAsientos() {
    return this.http.get<Asiento[]>(`${this.base}/asientos`);
  }
  actualizarAsiento(id: string, patch: Partial<Asiento>) {
    return this.http.patch<Asiento>(`${this.base}/asientos/${id}`, patch);
  }

  // Reservaciones
  getReservaciones() {
    return this.http.get<Reservacion[]>(`${this.base}/reservaciones`);
  }
  crearReservacion(r: Reservacion) {
    return this.http.post<Reservacion>(`${this.base}/reservaciones`, r);
  }
  actualizarReservacion(id: number, patch: Partial<Reservacion>) {
    return this.http.patch<Reservacion>(`${this.base}/reservaciones/${id}`, patch);
  }
  eliminarReservacion(id: number) {
    return this.http.delete(`${this.base}/reservaciones/${id}`);
  }

  // Nuevos endpoints atómicos del backend
  crearReservacionAtomica(payload: any) {
    return this.http.post<Reservacion>(`${this.base}/reservaciones/atomic`, payload);
  }
  cancelarReservacionAtomica(id: number, cui: string) {
    return this.http.post(`${this.base}/reservaciones/${id}/cancelar`, { cui });
  }
  modificarReservacionAtomica(id: number, nuevoAsiento: string, descripcion?: string, cui?: string) {
    return this.http.post<Reservacion>(`${this.base}/reservaciones/${id}/modificar`, { nuevoAsiento, descripcion, cui });
  }
  confirmarReservacion(id: number) {
    return this.http.post<Reservacion>(`${this.base}/reservaciones/${id}/confirmar`, {});
  }
  confirmarReservacionesLote(ids: number[]) {
    return this.http.post<{ok:boolean, updated:number}>(`${this.base}/reservaciones/confirmar-lote`, { ids });
  }

  // Helpers
  getReservasPorUsuario(email: string): Observable<Reservacion[]> {
    return this.getReservaciones().pipe(map(rs => rs.filter(r => r.usuario === email)));
  }
  getUsuarioPorEmail(email: string): Observable<Usuario | undefined> {
    return this.getUsuarios().pipe(map(us => us.find(u => u.email === email)));
  }
}
