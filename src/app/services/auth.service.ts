import { Injectable } from "@angular/core";
import { Usuario } from "../models";

@Injectable({ providedIn: "root" })
export class AuthService {
  private key = "weengz_current_user";

  get currentUser(): Usuario | null {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) as Usuario : null;
  }

  set currentUser(u: Usuario | null) {
    if (u) localStorage.setItem(this.key, JSON.stringify(u));
    else localStorage.removeItem(this.key);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  logout() {
    this.currentUser = null;
  }
}
