import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Clone request and add withCredentials to send cookies
  const authReq = req.clone({
    withCredentials: true
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized, try to refresh tokens blindly (since token is in HttpOnly cookie)
      if (error.status === 401) {
        // Prevent infinite loop if the refresh token endpoint itself returns 401
        if (req.url.includes('/refresh-token') || req.url.includes('/login')) {
          authService.clearSession();
          return throwError(() => error);
        }

        return authService.refreshTokens().pipe(
          switchMap(() => {
            // Retry the original request (cookies are sent automatically)
            const retryReq = req.clone({
              withCredentials: true
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            // Refresh failed, logout
            authService.clearSession();
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
