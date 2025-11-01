import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidatorFn, AbstractControl } from "@angular/forms";
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
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastrService,
    private auth: AuthService
  ) {
    this.form = this.fb.group({
      nombreCompleto: ["", [Validators.required, Validators.minLength(3)]],
      email: ["", [Validators.required, Validators.email, this.allowedDomainValidator(["gmail.com","outlook.com"]) ]],
      password: ["", [Validators.required, Validators.minLength(4)]]
    });
  }

  private isEmailDomainAllowed(email: string) {
    return /@gmail\.com$|@outlook\.com$/i.test(email);
  }

  // Custom validator to surface domain error in the control state
  private allowedDomainValidator(domains: string[]): ValidatorFn {
    const pattern = new RegExp(`@(${domains.map(d => d.replace(/\./g, "\\.")).join("|")})$`, "i");
    return (control: AbstractControl) => {
      const value = control.value as string;
      if (!value) return null;
      return pattern.test(value) ? null : { domain: true };
    };
  }

  get f() {
    return this.form.controls as any;
  }

  submit() {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombreCompleto, email } = this.form.value as any;
    if (!this.isEmailDomainAllowed(email)) {
      // This should rarely trigger since the control already validates domain,
      // but we keep it as a fallback.
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
        this.toast.success("Cuenta creada. Revisa tu correo y luego inicia sesión.");
        try { sessionStorage.setItem('lastRegisteredEmail', (created as any).email); } catch {}
        location.href = "/login";
      });
    });
  }
}