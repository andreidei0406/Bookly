import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface DashboardInsights {
  totalBookings: number;
  completionRate: number;
  activeServices: number;
  estimatedRevenue: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  getInsights(businessId: string): Observable<{ data: DashboardInsights }> {
    return this.http.get<{ data: DashboardInsights }>(
      `${this.apiUrl}/analytics/businesses/${businessId}/insights`
    ).pipe(
      catchError(error => {
        console.error('Error fetching insights:', error);
        return throwError(() => error);
      })
    );
  }
}
