import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-booking-cancel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div class="bg-card rounded-xl shadow-glass-lg border border-border p-8 max-w-md w-full text-center space-y-6">
        <div class="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h2 class="text-2xl font-bold tracking-tight">Booking Cancelled</h2>
        <p class="text-muted-foreground text-sm">
          The payment process was cancelled or failed. Your booking has not been confirmed.
        </p>
        
        <div class="pt-4">
          <button (click)="goBack()" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-10 px-8 py-2 w-full">
            Try Again
          </button>
        </div>
      </div>
    </div>
  `
})
export class BookingCancelComponent {
  goBack() {
    window.history.back();
  }
}
