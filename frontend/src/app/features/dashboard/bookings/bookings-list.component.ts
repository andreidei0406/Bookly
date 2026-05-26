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
        <div *ngFor="let booking of activeBookings()" class="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col md:flex-row">
          
          <!-- Date column -->
          <div class="flex flex-col items-center justify-center p-4 md:p-6 md:w-32 bg-slate-50 dark:bg-slate-900 border-r border-border">
            <span class="text-sm font-medium text-muted-foreground uppercase">{{ booking.date | date:'MMM' }}</span>
            <span class="text-3xl font-bold">{{ booking.date | date:'d' }}</span>
            <span class="text-sm text-muted-foreground">{{ booking.date | date:'EEE' }}</span>
          </div>

          <!-- Details -->
          <div class="flex-1 p-4 md:p-6">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div class="space-y-3">
                
                <div>
                  <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        [ngClass]="{
                          'bg-green-100 text-green-700': booking.status === 'CONFIRMED',
                          'bg-amber-100 text-amber-700': booking.status === 'PENDING',
                          'bg-red-100 text-red-700': booking.status === 'CANCELLED'
                        }">
                    {{ booking.status }}
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span class="font-medium">{{ booking.startTime }} - {{ booking.endTime }}</span>
                </div>
                
                <div class="mt-4 mb-2">
                  <span class="block font-medium text-lg">{{ booking.meetingName || 'Meeting' }}</span>
                  <span class="block text-sm text-muted-foreground mt-1">{{ booking.duration || 30 }} min</span>
                </div>
              
              <div class="font-medium mt-1 truncate text-sm">
                  <span>{{ booking.guestName }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                  <a href="mailto:{{ booking.guestEmail }}" class="text-blue-600 hover:underline">{{ booking.guestEmail }}</a>
              </div>
              <div *ngIf="booking.notes" class="flex items-start gap-2 mt-2 bg-muted/50 p-2 rounded-md">
                <svg class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span class="text-sm text-muted-foreground">{{ booking.notes }}</span>
                </div>

                <div *ngIf="booking.meetLink" class="mt-2">
                  <a [href]="booking.meetLink" target="_blank" class="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                    Join Google Meet
                  </a>
                </div>

              </div>

              <!-- Actions -->
              <div class="flex gap-2" *ngIf="booking.status !== 'CANCELLED'">
                <button 
                  (click)="cancelBooking(booking.id)" 
                  [disabled]="cancellingId() === booking.id"
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-red-600 h-8 px-3">
                  
                  <svg *ngIf="cancellingId() === booking.id" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <svg *ngIf="cancellingId() !== booking.id" class="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  Cancel
                </button>
              </div>
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
    // Ideally, we'd pass the specific businessId if they manage multiple, 
    // but the backend uses the user's implicit business if undefined.
    this.bookingService.getHostBookings().subscribe({
      next: (res) => {
        // Filter out completed/cancelled if desired, or sort them
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
        // Refresh list
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
