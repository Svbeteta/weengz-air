import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { ToastrService } from "ngx-toastr";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
      email: ["", [Validators.required, Validators.email]]
    });
  }

  login() {
    if (this.form.invalid) {
      this.toast.error("Ingrese un email válido.");
      return;
    }
    const email = this.form.value.email!;
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