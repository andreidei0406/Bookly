import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { BookingService, BookingResponse } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold tracking-tight">Bookings</h2>
        <p class="text-sm text-muted-foreground">
          {{ activeBookings().length }} upcoming booking(s)
        </p>
      </div>

      <div *ngIf="isLoading()" class="flex justify-center p-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <div *ngIf="!isLoading() && activeBookings().length === 0" class="rounded-lg border border-dashed p-8 text-center">
        <div class="mx-auto h-12 w-12 text-muted-foreground/50 mb-4 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        </div>
        <p class="text-muted-foreground">No upcoming bookings</p>
        <p class="text-sm text-muted-foreground mt-1">
          Share your booking link to get started!
        </p>
      </div>

      <div *ngIf="!isLoading() && activeBookings().length > 0" class="space-y-4">
        <div *ngFor="let booking of activeBookings()" class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          
          <div class="flex flex-col md:flex-row">
            <!-- Left: Date Badge -->
            <div class="flex flex-col items-center justify-center p-5 md:px-8 md:py-6 md:w-28 shrink-0 bg-primary/5 border-b md:border-b-0 md:border-r border-border">
              <span class="text-xs font-semibold text-primary uppercase tracking-widest">{{ booking.date | date:'MMM' }}</span>
              <span class="text-4xl font-extrabold text-foreground leading-none mt-1">{{ booking.date | date:'d' }}</span>
              <span class="text-xs text-muted-foreground mt-1">{{ booking.date | date:'EEEE' }}</span>
            </div>

            <!-- Center: Details -->
            <div class="flex-1 p-5 md:p-6 min-w-0">
              <div class="flex items-center gap-3 mb-3">
                <h3 class="text-lg font-semibold text-foreground truncate">{{ booking.meetingName || 'Meeting' }}</h3>
                <span class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-700': booking.status === 'CONFIRMED',
                        'bg-amber-100 text-amber-700': booking.status === 'PENDING',
                        'bg-red-100 text-red-700': booking.status === 'CANCELLED'
                      }">
                  {{ booking.status }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <!-- Time -->
                <div class="flex items-center gap-1.5">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke-width="2"/></svg>
                  <span class="font-medium text-foreground">{{ booking.startTime }} &#8211; {{ booking.endTime }}</span>
                  <span class="text-muted-foreground/70">({{ booking.duration || 30 }}m)</span>
                </div>

                <!-- Guest -->
                <div class="flex items-center gap-1.5">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span class="font-medium text-foreground">{{ booking.guestName }}</span>
                </div>

                <!-- Email -->
                <div class="flex items-center gap-1.5">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <a href="mailto:{{ booking.guestEmail }}" class="text-blue-600 hover:underline truncate">{{ booking.guestEmail }}</a>
                </div>
              </div>

              <!-- Notes -->
              <div *ngIf="booking.notes" class="mt-3 flex items-start gap-2 bg-muted/40 p-3 rounded-lg text-sm">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                <span class="text-muted-foreground">{{ booking.notes }}</span>
              </div>
            </div>

            <!-- Right: Actions & Meet Link -->
            <div class="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 p-5 md:p-6 md:pl-0 md:w-56 shrink-0 border-t md:border-t-0">
              
              <!-- Meet Link -->
              <div *ngIf="booking.meetLink" class="w-full">
                <a [href]="booking.meetLink" target="_blank"
                   class="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                  <span class="truncate">{{ booking.meetLink }}</span>
                </a>
              </div>

              <!-- Cancel Button -->
              <button *ngIf="booking.status !== 'CANCELLED'"
                (click)="cancelBooking(booking.id)" 
                [disabled]="cancellingId() === booking.id"
                class="w-full inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 h-9 px-4">
                <svg *ngIf="cancellingId() === booking.id" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <svg *ngIf="cancellingId() !== booking.id" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                {{ cancellingId() === booking.id ? 'Cancelling...' : 'Cancel Booking' }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class BookingsListComponent implements OnInit {
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);

  activeBookings = signal<BookingResponse[]>([]);
  isLoading = signal(true);
  cancellingId = signal<string | null>(null);

  ngOnInit() {
    this.fetchBookings();
  }

  fetchBookings() {
    this.isLoading.set(true);
    this.bookingService.getHostBookings().subscribe({
      next: (res) => {
        const upcoming = res.data.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED');
        this.activeBookings.set(upcoming);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load bookings', err);
        this.isLoading.set(false);
      }
    });
  }

  cancelBooking(id: string) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    this.cancellingId.set(id);
    this.bookingService.cancelBooking(id, 'Host cancelled').subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.fetchBookings();
      },
      error: (err) => {
        console.error('Failed to cancel', err);
        this.cancellingId.set(null);
        alert('Failed to cancel booking.');
      }
    });
  }
}
