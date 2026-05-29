import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { IntegrationService } from '../../../core/services/integration.service';
import { BookingService } from '../../../core/services/booking.service';
import { BillingService } from '../../../core/services/billing.service';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  const mockAuthService = {
    currentUser: signal({
      id: 'u123',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      platformRole: 'USER',
      plan: 'FREE'
    }),
    updateProfile: (data: any) => of({ data: {} }),
    logout: () => of(null)
  };

  const mockBillingService = {
    createCheckoutSession: (plan: string) => of({ success: true, data: { checkoutUrl: 'https://checkout.stripe.com/test' } }),
    confirmPayment: (sessionId: string) => of({ success: true, data: {}, message: 'Success' })
  };

  const mockAvailabilityService = {
    getBlocks: (start: string, end: string) => of({ data: [] }),
    createBlock: (block: any) => of({ data: {} }),
    updateBlock: (id: string, block: any) => of({ data: {} }),
    deleteBlock: (id: string) => of({ data: {} }),
    clearBlocks: (start: string, end: string) => of({ data: {} })
  };

  const mockIntegrationService = {
    getGoogleEvents: (start: string, end: string) => of({ data: [] })
  };

  const mockBookingService = {
    getHostBookings: (status: string) => of({ data: [] })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { tab: 'calendar' }
            }
          }
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: IntegrationService, useValue: mockIntegrationService },
        { provide: BookingService, useValue: mockBookingService }
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

