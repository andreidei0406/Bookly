import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';

export interface ServiceType {
  id: string;
  name: string;
  duration: number;
  price: number;
  paymentType: string;
}

export interface BusinessDetails {
  id: string;
  name: string;
  slug: string;
  email: string;
  services: ServiceType[];
}

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1`;

  getBusinessBySlug(slug: string): Observable<{ data: BusinessDetails }> {
    return this.http.get<{ data: BusinessDetails }>(`${this.apiUrl}/businesses/slug/${slug}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching business by slug:', error);
          return throwError(() => error);
        })
      );
  }
}
