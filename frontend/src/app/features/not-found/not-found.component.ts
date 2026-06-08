import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="relative min-h-screen flex items-center justify-center bg-white text-zinc-900 selection:bg-indigo-500/20 selection:text-indigo-900 overflow-hidden px-6">
      <!-- Modern Animated Mesh Background Glows -->
      <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div class="absolute top-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl animate-[pulse_8s_infinite_ease-in-out]"></div>
        <div class="absolute bottom-[20%] right-[20%] w-[55%] h-[55%] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.07)_0%,transparent_70%)] blur-3xl animate-[pulse_10s_infinite_ease-in-out]"></div>
      </div>

      <div class="max-w-md w-full text-center space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <!-- 404 Large Art -->
        <div class="relative inline-block select-none">
          <h1 class="text-9xl font-extrabold tracking-widest text-indigo-600/10 select-none leading-none">404</h1>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-500 tracking-tight">Oops!</span>
          </div>
        </div>

        <div class="space-y-3">
          <h2 class="text-3xl font-extrabold text-zinc-900 tracking-tight">Page Not Found</h2>
          <p class="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto">
            The link you followed might be broken, or the page has been removed. Let's get you back on track!
          </p>
        </div>

        <!-- Call to Action Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a routerLink="/" class="w-full sm:w-auto text-sm font-bold bg-indigo-600 text-white px-6 py-3.5 rounded-xl hover:bg-indigo-700 transition-all duration-300 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 hover:translate-y-[-1px] flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Homepage
          </a>
          <button (click)="goBack()" class="w-full sm:w-auto text-sm font-bold bg-white border border-zinc-200 text-zinc-700 px-6 py-3.5 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `
})
export class NotFoundComponent {
  private router = inject(Router);

  goBack() {
    const lastValidUrl = sessionStorage.getItem('lastValidBookingUrl');
    if (lastValidUrl) {
      this.router.navigateByUrl(lastValidUrl);
    } else {
      window.history.back();
    }
  }
}
