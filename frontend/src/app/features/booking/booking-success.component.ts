import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-booking-success',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-card sm:bg-muted/20 p-0 sm:p-4">
      <div class="bg-card rounded-none sm:rounded-xl shadow-none sm:shadow-glass-lg border-0 sm:border border-border p-6 sm:p-8 max-w-md w-full min-h-screen sm:min-h-0 flex flex-col justify-center text-center space-y-6">
        <div class="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 sm:mb-6 shrink-0">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h2 class="text-2xl font-bold tracking-tight">Booking Confirmed!</h2>
        <p class="text-muted-foreground text-sm">
          Your payment was successful and your appointment has been scheduled.
          You will receive a confirmation email shortly.
        </p>
        
        <div class="pt-4 shrink-0">
          <a routerLink="/" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2 w-full">
            Return Home
          </a>
        </div>
      </div>
    </div>
  `
})
export class BookingSuccessComponent {}
