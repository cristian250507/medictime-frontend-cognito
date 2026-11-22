import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { signOut } from 'aws-amplify/auth';

@Component({
  selector: 'app-medico',
  standalone: true,
  templateUrl: './medico.html',
  styleUrl: './medico.css'
})
export class Medico {
  constructor(private router: Router) {}

  async cerrarSesion() {
    await signOut();
    sessionStorage.removeItem('jwt_token');
    this.router.navigate(['/']);
  }
}



