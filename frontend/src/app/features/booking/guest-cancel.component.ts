import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookingService, BookingResponse } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-guest-cancel',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="min-h-screen bg-card sm:bg-[#f8fafc] flex items-center justify-center p-0 sm:p-4 relative overflow-hidden">
      
      <!-- Premium Animated Pastel Mesh Background -->
      <div class="mesh-container hidden sm:block">
        <div class="glow-blob blob-indigo"></div>
        <div class="glow-blob blob-purple"></div>
      </div>
      
      <div class="w-full max-w-md bg-card sm:premium-glass-card rounded-none sm:rounded-3xl p-6 sm:p-8 border-0 sm:border border-slate-200/80 relative overflow-hidden z-10 min-h-screen sm:min-h-0 flex flex-col justify-center">
        
        <div class="relative z-10 space-y-6">
          
          <!-- Loading state -->
          @if (isLoading()) {
            <div class="space-y-4 py-8 text-center flex flex-col items-center">
              <div class="w-12 h-12 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div>
              <p class="text-slate-500 font-medium text-sm mt-3 animate-pulse">Retrieving meeting details...</p>
            </div>
          }

          <!-- Error state -->
          @if (errorMsg() && !isLoading()) {
            <div class="space-y-6 text-center">
              <div class="mx-auto w-16 h-16 bg-red-50 border border-red-200/60 text-red-500 rounded-2xl flex items-center justify-center shadow-sm">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">Oops! Something went wrong</h2>
              <p class="text-slate-500 text-[14.5px] leading-relaxed">{{ errorMsg() }}</p>
              <div class="pt-4">
                <button (click)="goHome()" class="w-full py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all border border-slate-200/50 cursor-pointer">
                  Go to Home
                </button>
              </div>
            </div>
          }

          <!-- Success/Cancelled State -->
          @if (isCancelled() && !isLoading()) {
            <div class="space-y-6 text-center">
              <div class="mx-auto w-16 h-16 bg-emerald-50 border border-emerald-200/60 text-emerald-500 rounded-2xl flex items-center justify-center shadow-sm">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">Booking Cancelled</h2>
              <p class="text-slate-500 text-[14.5px] leading-relaxed">
                Your meeting has been successfully cancelled. The time slot has been opened up for others to reserve.
              </p>
              <p class="text-[#6366f1] text-[13.5px] font-bold mt-4 tracking-wide uppercase">
                Feel free to close this page.
              </p>
            </div>
          }

          <!-- Confirmation view -->
          @if (booking() && !isCancelled() && !isLoading() && !errorMsg()) {
            <div class="space-y-6">
              <div class="mx-auto w-16 h-16 bg-red-50 border border-red-200/60 text-red-500 rounded-2xl flex items-center justify-center shadow-sm">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              <div class="text-center">
                <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Cancel Appointment?</h2>
                <p class="text-slate-500 text-sm">Are you sure you want to cancel this reservation?</p>
              </div>

              <!-- Booking details summary card -->
              <div class="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 text-left space-y-3 relative overflow-hidden shadow-sm">
                <div class="flex justify-between items-center text-[13.5px]">
                  <span class="text-slate-500 font-medium">Meeting:</span>
                  <span class="text-slate-800 font-bold">{{ booking()?.meetingName }}</span>
                </div>
                <div class="border-t border-slate-200/60 my-2"></div>
                <div class="flex justify-between items-center text-[13.5px]">
                  <span class="text-slate-500 font-medium">Host:</span>
                  <span class="text-slate-800 font-bold">{{ booking()?.host?.firstName }} {{ booking()?.host?.lastName }}</span>
                </div>
                <div class="border-t border-slate-200/60 my-2"></div>
                <div class="flex justify-between items-center text-[13.5px]">
                  <span class="text-slate-500 font-medium">Date:</span>
                  <span class="text-slate-800 font-bold">{{ formatDate(booking()?.date) }}</span>
                </div>
                <div class="border-t border-slate-200/60 my-2"></div>
                <div class="flex justify-between items-center text-[13.5px]">
                  <span class="text-slate-500 font-medium">Time:</span>
                  <span class="text-slate-800 font-bold">{{ booking()?.startTime }} – {{ booking()?.endTime }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 pt-2">
                <button 
                  (click)="cancelBooking()"
                  [disabled]="isSubmitting()"
                  class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-semibold text-sm transition-all shadow-md shadow-red-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  @if (isSubmitting()) {
                    <span>Cancelling appointment...</span>
                  } @else {
                    <span>Yes, Cancel Meeting</span>
                  }
                </button>
                
                <button 
                  (click)="goBackToHost()"
                  [disabled]="isSubmitting()"
                  class="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all border border-slate-200 shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  Nevermind, keep it
                </button>
              </div>

            </div>
          }

        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes float-blob-1 {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.95); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes float-blob-2 {
      0% { transform: translate(0px, 0px) scale(1); }
      50% { transform: translate(-40px, 40px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .mesh-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .glow-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.5;
    }
    .blob-indigo {
      top: 10%; right: 15%;
      width: 350px; height: 350px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 70%);
      animation: float-blob-1 18s infinite ease-in-out;
    }
    .blob-purple {
      bottom: 10%; left: 10%;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0) 70%);
      animation: float-blob-2 22s infinite ease-in-out;
    }
    .premium-glass-card {
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(226, 232, 240, 0.8);
      backdrop-filter: blur(24px);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.02);
      transition: transform 0.4s ease, box-shadow 0.4s ease;
      &:hover {
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02);
      }
    }
  `]
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
