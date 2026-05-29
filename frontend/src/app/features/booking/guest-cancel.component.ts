import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookingService, BookingResponse } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-guest-cancel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-surface-dark bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface-darkMuted via-surface-dark to-black flex items-center justify-center p-4">
      
      <div class="w-full max-w-md bg-white/5 backdrop-blur-2xl shadow-glass-lg rounded-3xl p-8 border border-white/10 relative overflow-hidden">
        <!-- Decorative glow -->
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-red-500 rounded-full mix-blend-screen filter blur-[80px] opacity-35"></div>
        <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500 rounded-full mix-blend-screen filter blur-[80px] opacity-35"></div>

        <div class="relative z-10 text-center space-y-6">
          
          <!-- Loading state -->
          <div *ngIf="isLoading()" class="space-y-4 py-8">
            <div class="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-gray-400 text-sm">Retrieving meeting details...</p>
          </div>

          <!-- Error state -->
          <div *ngIf="errorMsg() && !isLoading()" class="space-y-6">
            <div class="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-white tracking-tight">Oops! Something went wrong</h2>
            <p class="text-gray-400 text-sm leading-relaxed">{{ errorMsg() }}</p>
            <div class="pt-4">
              <button (click)="goHome()" class="inline-flex items-center justify-center rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white h-11 px-6 w-full transition-all">
                Go to Home
              </button>
            </div>
          </div>

          <!-- Success/Cancelled State -->
          <div *ngIf="isCancelled() && !isLoading()" class="space-y-6">
            <div class="mx-auto w-16 h-16 bg-green-500/10 border border-green-500/30 text-green-400 rounded-2xl flex items-center justify-center shadow-lg">
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-white tracking-tight">Booking Cancelled</h2>
            <p class="text-gray-400 text-sm leading-relaxed">
              Your meeting has been successfully cancelled and deleted. The time slot has been opened up for others to reserve.
            </p>
            <p class="text-brand-400 text-sm font-semibold mt-4">
              Feel free to close this page.
            </p>
          </div>

          <!-- Confirmation view -->
          <div *ngIf="booking() && !isCancelled() && !isLoading() && !errorMsg()" class="space-y-6">
            <div class="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center shadow-lg">
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            
            <div>
              <h2 class="text-2xl font-bold text-white tracking-tight mb-2">Cancel Appointment?</h2>
              <p class="text-gray-400 text-sm">Are you sure you want to cancel this reservation?</p>
            </div>

            <!-- Booking details summary card -->
            <div class="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 relative overflow-hidden">
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-400">Meeting:</span>
                <span class="text-white font-semibold">{{ booking()?.meetingName }}</span>
              </div>
              <div class="border-t border-white/5 my-2"></div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-400">Host:</span>
                <span class="text-white font-semibold">{{ booking()?.host?.firstName }} {{ booking()?.host?.lastName }}</span>
              </div>
              <div class="border-t border-white/5 my-2"></div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-400">Date:</span>
                <span class="text-white font-semibold">{{ formatDate(booking()?.date) }}</span>
              </div>
              <div class="border-t border-white/5 my-2"></div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-400">Time:</span>
                <span class="text-white font-semibold">{{ booking()?.startTime }} – {{ booking()?.endTime }}</span>
              </div>
            </div>

            <div class="flex flex-col gap-3 pt-4">
              <button 
                (click)="cancelBooking()"
                [disabled]="isSubmitting()"
                class="inline-flex items-center justify-center rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white h-11 px-6 w-full shadow-lg hover:shadow-red-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                <span *ngIf="isSubmitting()">Cancelling appointment...</span>
                <span *ngIf="!isSubmitting()">Yes, Cancel Meeting</span>
              </button>
              
              <button 
                (click)="goBackToHost()"
                [disabled]="isSubmitting()"
                class="inline-flex items-center justify-center rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white h-11 px-6 w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Nevermind, keep it
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  `,
  styles: []
})
export class GuestCancelComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);

  booking = signal<BookingResponse | null>(null);
  isLoading = signal(true);
  isSubmitting = signal(false);
  isCancelled = signal(false);
  errorMsg = signal('');

  ngOnInit() {
    const bookingId = this.route.snapshot.paramMap.get('id');
    if (!bookingId) {
      this.errorMsg.set('No booking ID provided in the link.');
      this.isLoading.set(false);
      return;
    }

    this.bookingService.getPublicBooking(bookingId).subscribe({
      next: (res) => {
        if (res.data.status === 'CANCELLED') {
          this.isCancelled.set(true);
        } else {
          this.booking.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || 'Failed to retrieve meeting details. The link may be expired or invalid.');
        this.isLoading.set(false);
      }
    });
  }

  cancelBooking() {
    const bookingId = this.route.snapshot.paramMap.get('id');
    if (!bookingId) return;

    this.isSubmitting.set(true);
    this.bookingService.publicCancelBooking(bookingId).subscribe({
      next: () => {
        this.isCancelled.set(true);
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || 'Failed to cancel the booking. Please try again.');
        this.isSubmitting.set(false);
      }
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }

  goBackToHost() {
    const username = this.booking()?.host?.username;
    if (username) {
      this.router.navigate([`/booking/${username}`]);
    } else {
      this.router.navigate(['/']);
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
