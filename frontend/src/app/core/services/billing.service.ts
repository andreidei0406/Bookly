import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private readonly API_URL = 'http://localhost:3000/api/v1/billing';

  constructor(private http: HttpClient) {}

  /**
   * Initiate a Stripe Checkout session for plan upgrades
   * @param plan 'PREMIUM' | 'ULTIMATE'
   */
  createCheckoutSession(plan: 'PREMIUM' | 'ULTIMATE'): Observable<{ success: boolean; data: { checkoutUrl: string } }> {
    return this.http.post<{ success: boolean; data: { checkoutUrl: string } }>(
      `${this.API_URL}/checkout`,
      { plan },
      { withCredentials: true }
    );
  }

  /**
   * Confirm Stripe payment session and update profile state
   * @param sessionId Stripe Checkout Session ID
   */
  confirmPayment(sessionId: string): Observable<{ success: boolean; data: User; message: string }> {
    return this.http.post<{ success: boolean; data: User; message: string }>(
      `${this.API_URL}/confirm`,
      { sessionId },
      { withCredentials: true }
    );
  }
}
