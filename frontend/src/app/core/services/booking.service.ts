import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface BookingPayload {
  hostUsername?: string;
  guestName: string;
  guestEmail: string;
  meetingName: string;
  duration: number;
  date: string;
  startTime: string;
  notes?: string;
}

export interface BookingResponse {
  id: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  meetLink?: string;
  meetingName: string;
  duration: number;
  guestName: string;
  guestEmail: string;
  notes?: string;
  host?: any;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  /**
   * Create a new booking as a guest (public).
   */
  publicCreateBooking(payload: BookingPayload): Observable<{ data: BookingResponse }> {
    return this.http.post<{ data: BookingResponse }>(
      `${this.apiUrl}/bookings/public`,
      payload
    ).pipe(
      catchError(error => {
        console.error('Error creating public booking:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new booking as an authenticated user (self booking).
   */
  createBooking(payload: BookingPayload): Observable<{ data: BookingResponse }> {
    return this.http.post<{ data: BookingResponse }>(
      `${this.apiUrl}/bookings`,
      payload,
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Error creating booking:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get host's bookings
   */
  getHostBookings(status?: string): Observable<{ data: BookingResponse[], meta: any }> {
    let params: any = {};
    if (status) params.status = status;

    return this.http.get<{ data: BookingResponse[], meta: any }>(
      `${this.apiUrl}/bookings`,
      { params, withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Error fetching bookings:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancel a booking
   */
  cancelBooking(id: string, reason?: string): Observable<{ data: BookingResponse }> {
    return this.http.patch<{ data: BookingResponse }>(
      `${this.apiUrl}/bookings/${id}/status`,
      { status: 'CANCELLED', cancelReason: reason },
      { withCredentials: true }
    ).pipe(
      catchError(error => {
        console.error('Error cancelling booking:', error);
        return throwError(() => error);
      })
    );
  }
}
