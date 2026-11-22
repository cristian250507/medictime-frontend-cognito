import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { Medico } from './medico/medico';
import { Publico } from './publico/publico';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'medico', component: Medico },
  { path: 'publico', component: Publico },
  { path: '**', redirectTo: '' }
];
