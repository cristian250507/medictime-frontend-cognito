import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { signIn, signOut, signUp, confirmSignUp, resendSignUpCode, fetchAuthSession } from 'aws-amplify/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  vista: 'login' | 'registro' | 'confirmar' = 'login';

  email = '';
  password = '';
  codigoVerificacion = '';

  nombre = '';
  apellido = '';
  rut = '';
  fechaNacimiento = '';
  telefono = '';

  cargando = false;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    try {
      await signOut();
      sessionStorage.removeItem('jwt_token');
    } catch {}
  }

  cambiarVista(nuevaVista: 'login' | 'registro' | 'confirmar') {
    this.vista = nuevaVista;
    this.codigoVerificacion = '';
    this.cargando = false;
    this.cdr.detectChanges();
  }

  private guardarMapaUsuario(email: string, username: string) {
    if (typeof window === 'undefined') return;
    const mapa = JSON.parse(localStorage.getItem('cognito_email_map') || '{}');
    mapa[email.trim().toLowerCase()] = username;
    localStorage.setItem('cognito_email_map', JSON.stringify(mapa));
  }

  private obtenerUsernamePorEmail(email: string): string {
    if (typeof window === 'undefined') return email.trim();
    const mapa = JSON.parse(localStorage.getItem('cognito_email_map') || '{}');
    return mapa[email.trim().toLowerCase()] || email.trim();
  }

  private formatearTelefono(tel: string): string {
    const limpio = tel.replace(/\s+/g, '');
    return limpio.startsWith('+') ? limpio : `+56${limpio}`;
  }

  // Formatea automáticamente mientras el usuario escribe (ej. 219021194 -> 21.902.119-4)
  formatearRutInput() {
    let valor = this.rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (valor.length > 1) {
      const cuerpo = valor.slice(0, -1);
      const dv = valor.slice(-1);
      const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      this.rut = `${cuerpoFormateado}-${dv}`;
    } else {
      this.rut = valor;
    }
  }

  // Valida formato y dígito verificador real (Módulo 11)
  private validarRutChileno(rutCompleto: string): boolean {
    const limpio = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length < 8 || limpio.length > 9) return false;

    const cuerpo = limpio.slice(0, -1);
    const dvIngresado = limpio.slice(-1);

    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : resto.toString();

    return dvIngresado === dvEsperado;
  }

  private validarEmail(correo: string): boolean {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(correo.trim());
  }

  async iniciarSesion() {
    if (!this.email || !this.password) {
      alert('Ingresa tu correo y contraseña.');
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      try { await signOut(); } catch {}

      const { isSignedIn } = await signIn({
        username: this.email.trim(),
        password: this.password
      });

      if (isSignedIn) {
        const session = await fetchAuthSession();
        const jwt = session.tokens?.idToken?.toString();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('jwt_token', jwt || '');
        }

        if (jwt) {
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          const grupos = payload['cognito:groups'] || [];

          this.ngZone.run(() => {
            if (grupos.includes('Medico')) {
              this.router.navigate(['/medico']);
            } else {
              this.router.navigate(['/publico']);
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      this.ngZone.run(() => {
        if (error.name === 'UserNotConfirmedException') {
          alert('Tu cuenta aún no está confirmada. Ingresa el código enviado a tu correo.');
          this.cambiarVista('confirmar');
        } else {
          alert('Usuario o contraseña incorrectos.');
        }
      });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async registrarUsuario() {
    if (!this.nombre || !this.apellido || !this.rut || !this.fechaNacimiento || !this.telefono || !this.email || !this.password) {
      alert('Por favor completa todos los campos obligatorios.');
      return;
    }

    if (!this.validarRutChileno(this.rut)) {
      alert('El RUT ingresado no es válido. Verifica el número y dígito verificador (ej. 19.876.543-2).');
      return;
    }

    if (!this.validarEmail(this.email)) {
      alert('Ingresa un correo electrónico con formato válido (ej. usuario@dominio.cl).');
      return;
    }

    const correoNormalizado = this.email.trim().toLowerCase();
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const telefonoFormateado = this.formatearTelefono(this.telefono);
      const rutLimpio = this.rut.replace(/[^a-zA-Z0-9]/g, '');
      const usernameGenerado = `${this.nombre.trim().toLowerCase().replace(/\s+/g, '')}_${rutLimpio}`;

      const { nextStep } = await signUp({
        username: usernameGenerado,
        password: this.password,
        options: {
          userAttributes: {
            email: correoNormalizado,
            name: this.nombre.trim(),
            family_name: this.apellido.trim(),
            birthdate: this.fechaNacimiento,
            phone_number: telefonoFormateado,
            'custom:Rut': this.rut.trim()
          }
        }
      });

      this.guardarMapaUsuario(correoNormalizado, usernameGenerado);

      this.ngZone.run(() => {
        this.cargando = false;
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          this.vista = 'confirmar';
          this.codigoVerificacion = '';
          this.cdr.detectChanges();
          alert('¡Cuenta creada! Revisa tu correo e ingresa el código de verificación.');
        } else {
          this.iniciarSesion();
        }
      });
    } catch (error: any) {
      console.error('Error en registro:', error);
      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
        if (error.name === 'AliasExistsException' || error.name === 'UsernameExistsException') {
          alert('Este correo electrónico o RUT ya está registrado en MEDICTIME. Inicia sesión o usa otros datos.');
        } else {
          alert('No se pudo registrar: ' + (error.message || 'Verifica los datos ingresados.'));
        }
      });
    }
  }

  async confirmarCodigo() {
    if (!this.email || !this.codigoVerificacion) {
      alert('Ingresa tu correo y el código de 6 dígitos que llegó a tu bandeja.');
      return;
    }

    const usernameReal = this.obtenerUsernamePorEmail(this.email);
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: usernameReal,
        confirmationCode: this.codigoVerificacion.trim()
      });

      if (isSignUpComplete) {
        if (this.password) {
          await this.iniciarSesion();
        } else {
          this.ngZone.run(() => {
            this.cargando = false;
            this.vista = 'login';
            this.cdr.detectChanges();
            alert('¡Cuenta confirmada con éxito! Ahora inicia sesión con tu contraseña.');
          });
        }
      }
    } catch (error: any) {
      console.error('Error al confirmar código:', error);
      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
        if (error.name === 'AliasExistsException') {
          alert('Este correo electrónico ya fue verificado en otra cuenta. Inicia sesión con ese correo.');
        } else {
          alert('No se pudo confirmar: ' + (error.message || 'Verifica el correo y el código.'));
        }
      });
    }
  }

  async reenviarCodigo() {
    if (!this.email) {
      alert('Escribe tu correo electrónico para reenviar el código.');
      return;
    }

    const usernameReal = this.obtenerUsernamePorEmail(this.email);
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      await resendSignUpCode({ username: usernameReal });
      alert('¡Listo! Hemos reenviado un nuevo código de verificación a tu correo.');
    } catch (error: any) {
      console.error('Error al reenviar código:', error);
      alert('No se pudo reenviar el código: ' + (error.message || 'Intenta más tarde.'));
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

}
