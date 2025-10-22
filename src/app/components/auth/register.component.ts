import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { ToastrService } from "ngx-toastr";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./register.component.html"
})
export class RegisterComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastrService,
    private auth: AuthService
  ) {
    this.form = this.fb.group({
      nombreCompleto: ["", [Validators.required, Validators.minLength(3)]],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(4)]]
    });
  }

  private isEmailDomainAllowed(email: string) {
    return /@gmail\.com$|@outlook\.com$/i.test(email);
  }

  submit() {
    if (this.form.invalid) {
      this.toast.error("Complete el formulario correctamente.");
      return;
    }
    const { nombreCompleto, email } = this.form.value as any;
    if (!this.isEmailDomainAllowed(email)) {
      this.toast.error("Dominio no permitido. Use @gmail.com o @outlook.com");
      return;
    }
    this.api.getUsuarioPorEmail(email).subscribe(exists => {
      if (exists) {
        this.toast.error("El email ya está registrado.");
        return;
      }
      const u = {
        email,
        nombreCompleto,
        esVip: false,
        fechaCreacion: new Date().toISOString(),
        reservasCount: 0
      };
      this.api.crearUsuario(u as any).subscribe(created => {
        this.toast.success("Cuenta creada. Se envió confirmación (simulado).");
        this.auth.currentUser = created;
        location.href = "/seats";
      });
    });
  }
}