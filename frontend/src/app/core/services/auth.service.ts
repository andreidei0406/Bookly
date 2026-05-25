import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: string;
  googleId?: string;
  memberships?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api/v1/auth';
  
  // State using Angular Signals
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
  }

  /**
   * Called on startup via APP_INITIALIZER to see if the HttpOnly cookie is still valid
   * Resolves when the session check is complete to block app bootstrap.
   */
  checkSessionPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.http.get<{data: User}>(`${this.API_URL}/me`, { withCredentials: true }).subscribe({
        next: (res) => {
          this.currentUser.set(res.data);
          this.isAuthenticated.set(true);
          resolve();
        },
        error: () => {
          this.currentUser.set(null);
          this.isAuthenticated.set(false);
          resolve();
        }
      });
    });
  }

  setSession(user: User) {
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
  }

  login(credentials: any) {
    return this.http.post<{data: {user: User}}>(`${this.API_URL}/login`, credentials, { withCredentials: true }).pipe(
      tap(res => {
        this.setSession(res.data.user);
        this.router.navigate(['/dashboard']);
      })
    );
  }

  register(userData: any) {
    return this.http.post<{data: {user: User}}>(`${this.API_URL}/register`, userData, { withCredentials: true }).pipe(
      tap(res => {
        this.setSession(res.data.user);
        this.router.navigate(['/dashboard']);
      })
    );
  }

  logout() {
    return this.http.post(`${this.API_URL}/logout`, {}).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        this.clearSession();
        return throwError(() => new Error('Logout failed'));
      })
    );
  }

  clearSession() {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  refreshTokens() {
    return this.http.post(`${this.API_URL}/refresh-token`, {}, { withCredentials: true });
  }

  disconnectGoogle() {
    return this.http.delete<{data: User}>(`${this.API_URL}/google`, { withCredentials: true });
  }
}
