import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { ToastrService } from "ngx-toastr";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: "./login.component.html"
})
export class LoginComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastrService,
    private auth: AuthService
  ) {
    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(4)]]
    });
  }

  login() {
    if (this.form.invalid) {
      this.toast.error("Ingrese credenciales válidas.");
      return;
    }
    const email = this.form.value.email!;
    // Nota: Por ahora la contraseña no se valida en el servidor.
    // Se recoge desde la vista para preparar la futura integración.
    this.api.getUsuarioPorEmail(email).subscribe(u => {
      if (!u) {
        this.toast.error("Usuario no encontrado. Regístrese primero.");
        return;
      }
      this.auth.currentUser = u;
      this.toast.success("Sesión iniciada.");
      location.href = "/seats";
    });
  }
}