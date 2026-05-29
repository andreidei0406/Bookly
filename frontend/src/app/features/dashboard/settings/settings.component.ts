import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
        <p class="text-sm text-muted-foreground mt-1">Manage your account and integrations.</p>
      </div>

      <div class="grid gap-8 md:grid-cols-2">
        
        <!-- Profile Settings -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 pb-4 border-b border-border flex justify-between items-center">
            <h3 class="text-lg font-semibold tracking-tight">Profile Details</h3>
          </div>
          <div class="p-6 space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">First Name</label>
              <input type="text" [ngModel]="currentUser()?.firstName" disabled class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Last Name</label>
              <input type="text" [ngModel]="currentUser()?.lastName" disabled class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50">
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email Address</label>
              <input type="email" [ngModel]="currentUser()?.email" disabled class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50">
            </div>
            <div class="pt-4">
              <button disabled class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Integrations -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 pb-4 border-b border-border">
            <h3 class="text-lg font-semibold tracking-tight">Integrations</h3>
            <p class="text-sm text-muted-foreground mt-1">Connect your calendar to prevent double bookings.</p>
          </div>
          <div class="p-6 space-y-4">
            
            <!-- Google Calendar -->
            <div class="rounded-xl border border-border p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-white rounded-lg border border-border shadow-sm flex items-center justify-center p-2 shrink-0">
                    <svg viewBox="0 0 24 24" class="w-full h-full"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-foreground">Google Calendar & Meet</h4>
                    <span *ngIf="currentUser()?.googleId" class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 mt-1 border border-green-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Connected
                    </span>
                    <span *ngIf="!currentUser()?.googleId" class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 mt-1 border border-slate-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      Not Connected
                    </span>
                  </div>
                </div>
                
                <div *ngIf="!currentUser()?.googleId" class="shrink-0">
                  <button 
                    (click)="connectGoogle()"
                    class="inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                    Connect
                  </button>
                </div>
                <div *ngIf="currentUser()?.googleId" class="shrink-0">
                  <button 
                    (click)="disconnectGoogle()"
                    class="inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors border border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 h-8 px-3">
                    Disconnect
                  </button>
                </div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground leading-relaxed pl-[52px]">
                Sync bookings to your calendar and automatically generate Google Meet video conference links for guests.
              </div>
            </div>

            <!-- Stripe Integration -->
            <div class="rounded-xl border border-border p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-xl shrink-0">
                    S
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-foreground">Stripe</h4>
                    <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 mt-1 border border-slate-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      Not Connected
                    </span>
                  </div>
                </div>
                <div class="shrink-0">
                  <button 
                    class="inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                    Connect
                  </button>
                </div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground leading-relaxed pl-[52px]">
                Accept secure online payments from guests when they book an appointment.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;

  connectGoogle() {
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  }

  disconnectGoogle() {
    this.authService.disconnectGoogle().subscribe({
      next: (res) => {
        this.authService.setSession(res.data);
      },
      error: (err) => {
        console.error('Failed to disconnect Google', err);
        alert('Failed to disconnect Google account.');
      }
    });
  }
}
