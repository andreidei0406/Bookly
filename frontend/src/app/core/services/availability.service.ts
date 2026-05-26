import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface AvailabilityBlock {
  id?: string;
  date: string | Date;
  startTime: string;
  endTime: string;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  /**
   * Get available booking slots for a public user profile.
   */
  getAvailableSlots(username: string, date: string, duration: number = 30): Observable<{ data: AvailableSlot[] }> {
    return this.http.get<{ data: AvailableSlot[] }>(
      `${this.apiUrl}/users/${username}/availability/slots?date=${date}&duration=${duration}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching available slots:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available days for a public user profile in a month.
   */
  getAvailableDays(username: string, month: string): Observable<{ data: string[] }> {
    return this.http.get<{ data: string[] }>(
      `${this.apiUrl}/users/${username}/availability/days?month=${month}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching available days:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get availability blocks for the authenticated user.
   */
  getBlocks(startDate?: string, endDate?: string): Observable<{ data: AvailabilityBlock[] }> {
    let url = `${this.apiUrl}/availability/blocks`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    return this.http.get<{ data: AvailabilityBlock[] }>(url, { withCredentials: true });
  }

  /**
   * Create an availability block for the authenticated user.
   */
  createBlock(data: { date: string, startTime: string, endTime: string }): Observable<{ data: AvailabilityBlock }> {
    return this.http.post<{ data: AvailabilityBlock }>(
      `${this.apiUrl}/availability/blocks`,
      data,
      { withCredentials: true }
    );
  }

  /**
   * Clear availability blocks for the authenticated user.
   */
  clearBlocks(startDate?: string, endDate?: string): Observable<{ data: any }> {
    let url = `${this.apiUrl}/availability/blocks/clear`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    return this.http.delete<{ data: any }>(url, { withCredentials: true });
  }

  /**
   * Update an availability block.
   */
  updateBlock(blockId: string, data: { date: string, startTime: string, endTime: string }): Observable<{ data: AvailabilityBlock }> {
    return this.http.put<{ data: AvailabilityBlock }>(
      `${this.apiUrl}/availability/blocks/${blockId}`,
      data,
      { withCredentials: true }
    );
  }

  /**
   * Delete an availability block.
   */
  deleteBlock(blockId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/availability/blocks/${blockId}`,
      { withCredentials: true }
    );
  }
}
