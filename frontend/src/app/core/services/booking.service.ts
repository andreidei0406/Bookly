import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

export interface BookingPayload {
  businessId: string;
  serviceId: string;
  guestName?: string;
  guestEmail?: string;
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
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  /**
   * Get available slots for a given business, service, and date.
   */
  getAvailableSlots(businessId: string, serviceId: string, date: string): Observable<{ data: AvailableSlot[] }> {
    return this.http.get<{ data: AvailableSlot[] }>(
      `${this.apiUrl}/businesses/${businessId}/availability/slots`,
      { params: { serviceId, date } }
    ).pipe(
      catchError(error => {
        console.error('Error fetching available slots:', error);
        return throwError(() => error);
      })
    );
  }

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
   * Create a new booking as an authenticated user.
   */
  createBooking(payload: BookingPayload): Observable<{ data: BookingResponse }> {
    return this.http.post<{ data: BookingResponse }>(
      `${this.apiUrl}/bookings`,
      payload
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
  getHostBookings(businessId?: string, status?: string): Observable<{ data: BookingResponse[], meta: any }> {
    let params: any = {};
    if (businessId) params.businessId = businessId;
    if (status) params.status = status;

    return this.http.get<{ data: BookingResponse[], meta: any }>(
      `${this.apiUrl}/bookings`,
      { params }
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
      { status: 'CANCELLED', cancelReason: reason }
    ).pipe(
      catchError(error => {
        console.error('Error cancelling booking:', error);
        return throwError(() => error);
      })
    );
  }
}
