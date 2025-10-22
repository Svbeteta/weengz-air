import { Routes } from '@angular/router';
import { RegisterComponent } from './components/auth/register.component';
import { LoginComponent } from './components/auth/login.component';
import { SeatsComponent } from './components/seats/seats.component';
import { ReservationsComponent } from './components/reservations/reservations.component';
import { ReportsComponent } from './components/reports/reports.component';
import { XmlIoComponent } from './components/xml-io/xml-io.component';

export const routes: Routes = [
  { path: '', redirectTo: 'seats', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'seats', component: SeatsComponent },
  { path: 'reservations', component: ReservationsComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'xml', component: XmlIoComponent },
  { path: '**', redirectTo: 'seats' }
];