import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { environment } from '../../environments/environment';

export interface MedicoItem {
  id: number;
  nombre: string;
  especialidad: string;
  sucursal: string;
  box: string;
  disponibles: string[];
}

export interface CitaAgendada {
  codigo: string;
  paciente: string;
  rut: string;
  medico: MedicoItem;
  fecha: string;
  hora: string;
  motivo: string;
  estado: 'Confirmada' | 'Cancelada';
}

@Component({
  selector: 'app-publico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './publico.html',
  styleUrls: ['./publico.css']
})
export class Publico implements OnInit {
  usuarioEmail = 'paciente@clinica.cl';
  rolCognito = 'Publico';
  fechaMinima = '';

  // Conexión real preparada para el backend de tu compañero
  private readonly apiUrl = environment.apiUrl;
  cargandoMedicos = false;
  errorCargaMedicos = false;

  // Lista vacía que se poblará desde la BD vía API
  medicos: MedicoItem[] = [];

  especialidadSeleccionada = 'Todas';
  medicoSeleccionadoId: number | null = null;

  formulario = {
    paciente: '',
    rut: '',
    fecha: '',
    hora: '',
    motivo: ''
  };

  citaReciente: CitaAgendada | null = null;
  historialCitas: CitaAgendada[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    this.fechaMinima = `${yyyy}-${mm}-${dd}`;
    this.formulario.fecha = this.fechaMinima;

    this.cargarDatosDesdeCognito();
    this.obtenerMedicosDesdeBackend();
  }

  cargarDatosDesdeCognito() {
    if (typeof window === 'undefined') return;

    const jwt = sessionStorage.getItem('jwt_token');
    if (jwt) {
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        this.usuarioEmail = payload.email || payload['cognito:username'] || this.usuarioEmail;

        if (payload.name && payload.family_name) {
          this.formulario.paciente = `${payload.name} ${payload.family_name}`;
        } else if (payload.name) {
          this.formulario.paciente = payload.name;
        }

        if (payload['custom:Rut']) {
          this.formulario.rut = payload['custom:Rut'];
        }

        const grupos = payload['cognito:groups'] || [];
        if (grupos.length > 0) {
          this.rolCognito = grupos.join(', ');
        }
      } catch (e) {
        console.warn('No se pudo decodificar el payload del JWT', e);
      }
    }
  }

  obtenerMedicosDesdeBackend() {
    this.cargandoMedicos = true;
    this.errorCargaMedicos = false;

    this.http.get<MedicoItem[]>(`${this.apiUrl}/medicos`).subscribe({
      next: (data) => {
        this.medicos = data;
        if (this.medicos.length > 0) {
          this.medicoSeleccionadoId = this.medicos[0].id;
        }
        this.cargandoMedicos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.medicos = [];
        this.errorCargaMedicos = true;
        this.cargandoMedicos = false;
        this.cdr.detectChanges();
      }
    });
  }

  get especialidades(): string[] {
    const unicas = new Set(this.medicos.map(m => m.especialidad));
    return ['Todas', ...Array.from(unicas)];
  }

  get medicosFiltrados(): MedicoItem[] {
    if (this.especialidadSeleccionada === 'Todas') {
      return this.medicos;
    }
    return this.medicos.filter(m => m.especialidad === this.especialidadSeleccionada);
  }

  get medicoSeleccionado(): MedicoItem | undefined {
    return this.medicos.find(m => m.id === Number(this.medicoSeleccionadoId));
  }

  alCambiarEspecialidad() {
    const lista = this.medicosFiltrados;
    if (lista.length > 0) {
      this.medicoSeleccionadoId = lista[0].id;
      this.formulario.hora = '';
    }
  }

  seleccionarMedico(medico: MedicoItem) {
    this.medicoSeleccionadoId = medico.id;
    this.formulario.hora = '';
  }

  seleccionarHora(hora: string) {
    this.formulario.hora = hora;
  }

  agendarCita() {
    const medicoObj = this.medicoSeleccionado;
    if (!this.formulario.paciente || !this.formulario.fecha || !this.formulario.hora || !medicoObj) {
      alert('Por favor selecciona un médico, fecha y bloque horario.');
      return;
    }

    if (this.formulario.fecha < this.fechaMinima) {
      alert('No puedes agendar una cita en una fecha que ya pasó.');
      return;
    }

    const payloadCita = {
      pacienteNombre: this.formulario.paciente,
      pacienteRut: this.formulario.rut,
      pacienteEmail: this.usuarioEmail,
      medicoId: medicoObj.id,
      fecha: this.formulario.fecha,
      hora: this.formulario.hora,
      motivo: this.formulario.motivo || 'Consulta médica general'
    };

    this.http.post<CitaAgendada>(`${this.apiUrl}/citas`, payloadCita).subscribe({
      next: (citaGuardada) => {
        this.citaReciente = citaGuardada;
        this.historialCitas.unshift(citaGuardada);
        this.formulario.hora = '';
        this.formulario.motivo = '';
        this.cdr.detectChanges();
      },
      error: () => {
        alert('Error al conectar con la base de datos para guardar la cita.');
      }
    });
  }

  cancelarCita(cita: CitaAgendada) {
    this.http.patch(`${this.apiUrl}/citas/${cita.codigo}/cancelar`, {}).subscribe({
      next: () => {
        cita.estado = 'Cancelada';
        this.cdr.detectChanges();
      },
      error: () => {
        alert('Error al conectar con la base de datos para cancelar la cita.');
      }
    });
  }

  async cerrarSesion() {
    try {
      await signOut();
    } catch {}
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('jwt_token');
    }
    this.router.navigate(['/']);
  }
}
