import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface WorkingHours {
  id?: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  /**
   * Get working hours for a business.
   */
  getWorkingHours(businessId: string): Observable<{ data: WorkingHours[] }> {
    return this.http.get<{ data: WorkingHours[] }>(
      `${this.apiUrl}/businesses/${businessId}/availability/working-hours`
    ).pipe(
      catchError(error => {
        console.error('Error fetching working hours:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update working hours for a business.
   */
  updateWorkingHours(businessId: string, hours: WorkingHours[]): Observable<{ data: WorkingHours[] }> {
    return this.http.put<{ data: WorkingHours[] }>(
      `${this.apiUrl}/businesses/${businessId}/availability/working-hours`,
      { hours }
    ).pipe(
      catchError(error => {
        console.error('Error updating working hours:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get availability blocks for a business.
   */
  getBlocks(businessId: string, startDate?: string, endDate?: string): Observable<{ data: any[] }> {
    let url = `${this.apiUrl}/businesses/${businessId}/availability/blocks`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    return this.http.get<{ data: any[] }>(url, { withCredentials: true });
  }

  /**
   * Create an availability block.
   */
  createBlock(businessId: string, data: { date: string, startTime: string, endTime: string }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(
      `${this.apiUrl}/businesses/${businessId}/availability/blocks`,
      data,
      { withCredentials: true }
    );
  }

  /**
   * Clear availability blocks for a business.
   */
  clearBlocks(businessId: string, startDate?: string, endDate?: string): Observable<{ data: any }> {
    let url = `${this.apiUrl}/businesses/${businessId}/availability/blocks/clear`;
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
  updateBlock(businessId: string, blockId: string, data: { date: string, startTime: string, endTime: string }): Observable<{ data: any }> {
    return this.http.put<{ data: any }>(
      `${this.apiUrl}/businesses/${businessId}/availability/blocks/${blockId}`,
      data,
      { withCredentials: true }
    );
  }

  /**
   * Delete an availability block.
   */
  deleteBlock(businessId: string, blockId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/businesses/${businessId}/availability/blocks/${blockId}`,
      { withCredentials: true }
    );
  }
}
