import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // No adjuntar el token de Cognito a las rutas públicas de ms-medicos
  if (req.url.includes('/public/')) {
    return next(req);
  }

  // Obtenemos el JWT que guardamos durante el login
  const token = sessionStorage.getItem('jwt_token');

  // Si existe el token, clonamos la petición y le agregamos la cabecera
  if (token) {
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedReq);
  }

  // Si no hay token (ej. usuario no logueado), la petición sigue normal
  return next(req);
};