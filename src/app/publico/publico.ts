import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signOut } from 'aws-amplify/auth';

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
  // Información extraída de la sesión de Cognito
  usuarioEmail = 'paciente@clinica.cl';
  rolCognito = 'Publico';

  // Fecha mínima permitida (hoy)
  fechaMinima = '';

  // Estado de conexión al backend (API Gateway -> ECS Spring Boot)
  private readonly apiUrl = 'https://tu-api-gateway.execute-api.us-east-1.amazonaws.com/prod/api';
  cargandoMedicos = false;

  // Catálogo de médicos
  medicos: MedicoItem[] = [
    {
      id: 1,
      nombre: 'Dra. Camila Valenzuela',
      especialidad: 'Medicina General',
      sucursal: 'Sede Central',
      box: 'Box 102',
      disponibles: ['09:00', '09:30', '10:30', '11:30', '15:00', '16:30']
    },
    {
      id: 2,
      nombre: 'Dr. Sebastián Rojas',
      especialidad: 'Cardiología',
      sucursal: 'Sede Central',
      box: 'Box 205',
      disponibles: ['08:30', '10:00', '11:00', '14:30', '16:00']
    },
    {
      id: 3,
      nombre: 'Dra. Valentina Muñoz',
      especialidad: 'Pediatría',
      sucursal: 'Sede Norte',
      box: 'Box 108',
      disponibles: ['09:00', '10:00', '11:00', '12:00', '15:30', '17:00']
    },
    {
      id: 4,
      nombre: 'Dr. Matías Contreras',
      especialidad: 'Dermatología',
      sucursal: 'Sede Norte',
      box: 'Box 301',
      disponibles: ['09:30', '10:30', '14:00', '15:00', '16:30']
    },
    {
      id: 5,
      nombre: 'Dra. Fernanda Soto',
      especialidad: 'Traumatología',
      sucursal: 'Sede Central',
      box: 'Box 110',
      disponibles: ['08:30', '09:30', '11:30', '15:00', '17:30']
    }
  ];

  // Filtros y selección
  especialidadSeleccionada = 'Todas';
  medicoSeleccionadoId: number = 1;

  // Formulario de reserva
  formulario = {
    paciente: '',
    rut: '',
    fecha: '',
    hora: '',
    motivo: ''
  };

  citaReciente: CitaAgendada | null = null;
  historialCitas: CitaAgendada[] = [];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    // Calcula la fecha actual local en formato YYYY-MM-DD para bloquear días pasados
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
    // Preparado para conectar con Spring Boot (GET /api/medicos)
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
      alert('Por favor completa la fecha y selecciona un bloque horario.');
      return;
    }

    if (this.formulario.fecha < this.fechaMinima) {
      alert('No puedes agendar una cita en una fecha que ya pasó.');
      return;
    }

    const nuevaCita: CitaAgendada = {
      codigo: 'MT-' + Math.floor(1000 + Math.random() * 9000),
      paciente: this.formulario.paciente,
      rut: this.formulario.rut || 'No informado',
      medico: medicoObj,
      fecha: this.formulario.fecha,
      hora: this.formulario.hora,
      motivo: this.formulario.motivo || 'Consulta médica general',
      estado: 'Confirmada'
    };

    this.citaReciente = nuevaCita;
    this.historialCitas.unshift(nuevaCita);
    this.formulario.hora = '';
    this.formulario.motivo = '';
  }

  cancelarCita(cita: CitaAgendada) {
    cita.estado = 'Cancelada';
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
