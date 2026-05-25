import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface GoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

@Injectable({
  providedIn: 'root'
})
export class IntegrationService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  getGoogleEvents(startDate?: string, endDate?: string): Observable<{ data: GoogleEvent[] }> {
    let url = `${this.apiUrl}/integrations/google/events`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.http.get<{ data: GoogleEvent[] }>(url, { withCredentials: true }).pipe(
      catchError(error => {
        console.error('Error fetching google events:', error);
        return throwError(() => error);
      })
    );
  }
}
