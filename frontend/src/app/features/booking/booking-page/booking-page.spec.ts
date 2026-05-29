import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { BookingPageComponent } from './booking-page.component';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { BookingService } from '../../../core/services/booking.service';

describe('BookingPage', () => {
  let component: BookingPageComponent;
  let fixture: ComponentFixture<BookingPageComponent>;

  const mockAuthService = {
    getPublicProfile: (username: string) => of({
      data: {
        id: 'u123',
        email: 'host@example.com',
        username: 'testuser',
        firstName: 'Host',
        lastName: 'User',
        platformRole: 'USER',
        plan: 'FREE'
      }
    }),
    currentUser: () => null
  };

  const mockAvailabilityService = {
    getAvailableDays: (username: string, month: string) => of({ data: ['2026-05-29'] }),
    getAvailableSlots: (username: string, date: string, duration: number) => of({ data: [] })
  };

  const mockBookingService = {
    publicCreateBooking: (payload: any) => of({ success: true })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ username: 'testuser' }),
              queryParamMap: convertToParamMap({ meeting: 'Intro', duration: '30' })
            }
          }
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: BookingService, useValue: mockBookingService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

