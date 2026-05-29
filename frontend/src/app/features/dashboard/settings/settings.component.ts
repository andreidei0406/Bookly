import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
        <p class="text-sm text-muted-foreground mt-1">Manage your account, subscription plan, and integrations.</p>
      </div>

      <!-- Payment Success Alert Banner -->
      <div *ngIf="paymentSuccessMessage()" class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 backdrop-blur-sm text-emerald-800 animate-in slide-in-from-top-5 duration-300 shadow-sm flex items-center gap-3">
        <svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-sm font-medium">{{ paymentSuccessMessage() }}</div>
      </div>

      <!-- Payment Verifying Loading Spinner -->
      <div *ngIf="isVerifyingPayment()" class="p-8 rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center gap-3 text-center">
        <svg class="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span class="text-sm font-bold text-zinc-800">Verifying Payment Status...</span>
        <p class="text-xs text-zinc-500">Please wait while we verify your purchase with Stripe.</p>
      </div>

      <!-- Subscription Plan Panel -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div class="p-6 pb-4 border-b border-border">
          <h3 class="text-lg font-bold tracking-tight">Subscription Plan</h3>
          <p class="text-sm text-muted-foreground mt-1">Your current active subscription plan details.</p>
        </div>
        <div class="p-6">
          <div class="grid gap-5 sm:grid-cols-3">
            
            <!-- Free Plan -->
            <div 
              [ngClass]="{
                'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-500/10': currentUser()?.plan === 'FREE',
                'border-border opacity-70 bg-zinc-50/30': currentUser()?.plan !== 'FREE'
              }"
              class="relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <h4 class="font-bold text-zinc-900">Free</h4>
                    <p class="text-xs text-zinc-400 mt-0.5">$0 / month</p>
                  </div>
                  <span *ngIf="currentUser()?.plan === 'FREE'" class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    <span class="w-1 h-1 rounded-full bg-indigo-600"></span> Active
                  </span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed mb-4">Set your internal availability blocks on the dashboard.</p>
                <ul class="text-[11px] text-zinc-600 space-y-2">
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Set visual availability</li>
                  <li class="text-zinc-300 flex items-center gap-2"><span>✖</span> Share booking links</li>
                  <li class="text-zinc-300 flex items-center gap-2"><span>✖</span> Google Calendar & Meet</li>
                </ul>
              </div>
              <div class="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-center select-none"
                   [ngClass]="currentUser()?.plan === 'FREE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-zinc-100 text-zinc-400'">
                {{ currentUser()?.plan === 'FREE' ? 'Current Plan' : 'Not Active' }}
              </div>
            </div>
 
            <!-- Premium Plan -->
            <div 
              [ngClass]="{
                'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-500/10': currentUser()?.plan === 'PREMIUM',
                'border-border opacity-70 bg-zinc-50/30': currentUser()?.plan !== 'PREMIUM'
              }"
              class="relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <h4 class="font-bold text-zinc-900">Premium</h4>
                    <p class="text-xs text-zinc-400 mt-0.5">$9 / month</p>
                  </div>
                  <span *ngIf="currentUser()?.plan === 'PREMIUM'" class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    <span class="w-1 h-1 rounded-full bg-indigo-600"></span> Active
                  </span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed mb-4">Share booking links and receive secure bookings from guests.</p>
                <ul class="text-[11px] text-zinc-600 space-y-2">
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Set visual availability</li>
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Share booking links</li>
                  <li class="text-zinc-300 flex items-center gap-2"><span>✖</span> Google Calendar & Meet</li>
                </ul>
              </div>

              <!-- Button / Inactive state for Premium -->
              <button *ngIf="currentUser()?.plan === 'FREE'"
                      (click)="upgradePlan('PREMIUM')"
                      class="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-colors cursor-pointer">
                Upgrade to Premium ($9)
              </button>
              <div *ngIf="currentUser()?.plan !== 'FREE'"
                   class="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-center select-none"
                   [ngClass]="currentUser()?.plan === 'PREMIUM' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-zinc-100 text-zinc-400'">
                {{ currentUser()?.plan === 'PREMIUM' ? 'Current Plan' : 'Not Active' }}
              </div>
            </div>
 
            <!-- Ultimate Plan -->
            <div 
              [ngClass]="{
                'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20': currentUser()?.plan === 'ULTIMATE',
                'border-border opacity-70 bg-zinc-50/30': currentUser()?.plan !== 'ULTIMATE'
              }"
              class="relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between group">
              <div *ngIf="currentUser()?.plan === 'ULTIMATE'" class="absolute -top-3 right-4 bg-indigo-600 text-white text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-widest shadow-md shadow-indigo-600/15">Active Plan</div>
              <div *ngIf="currentUser()?.plan !== 'ULTIMATE'" class="absolute -top-3 right-4 bg-zinc-500 text-white text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-widest">Best Value</div>
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <h4 class="font-bold text-zinc-900">Ultimate</h4>
                    <p class="text-xs text-zinc-400 mt-0.5">$19 / month</p>
                  </div>
                  <span *ngIf="currentUser()?.plan === 'ULTIMATE'" class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    <span class="w-1 h-1 rounded-full bg-indigo-600"></span> Active
                  </span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed mb-4">Complete scheduling suite with Google Calendar and Meet integrations.</p>
                <ul class="text-[11px] text-zinc-600 space-y-2">
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Set visual availability</li>
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Share booking links</li>
                  <li class="flex items-center gap-2"><span class="text-indigo-600 font-bold">✔</span> Google Calendar & Meet</li>
                </ul>
              </div>

              <!-- Button / Inactive state for Ultimate -->
              <button *ngIf="currentUser()?.plan === 'FREE' || currentUser()?.plan === 'PREMIUM'"
                      (click)="upgradePlan('ULTIMATE')"
                      class="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-colors cursor-pointer">
                Upgrade to Ultimate ($19)
              </button>
              <div *ngIf="currentUser()?.plan === 'ULTIMATE'"
                   class="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-center select-none bg-indigo-50 text-indigo-700 border border-indigo-200">
                Current Active Plan
              </div>
            </div>
 
          </div>
        </div>
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
            
            <!-- Google Calendar (Locked/unlocked based on plan) -->
            <div class="rounded-xl border border-border p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors relative overflow-hidden">
              
              <!-- Lock Overlay for Free/Premium users (bypassed if already connected so user can disconnect) -->
              <div *ngIf="currentUser()?.plan !== 'ULTIMATE' && !currentUser()?.googleId" class="absolute inset-0 bg-white/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-300">
                <svg class="w-6 h-6 text-indigo-600 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span class="text-xs font-bold text-zinc-800">Requires Ultimate Plan</span>
                <p class="text-[10px] text-zinc-500 max-w-xs mt-1">Sync Bookly with Google Calendar and auto-generate Google Meet links.</p>
                <button (click)="upgradePlan('ULTIMATE')" class="mt-3 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm cursor-pointer">Upgrade to Ultimate</button>
              </div>

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

          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private billingService = inject(BillingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isVerifyingPayment = signal(false);
  paymentSuccessMessage = signal<string | null>(null);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];
      const success = params['success'];
      if (sessionId && success === 'true') {
        this.confirmUserUpgrade(sessionId);
      }
    });
  }

  confirmUserUpgrade(sessionId: string) {
    this.isVerifyingPayment.set(true);
    this.billingService.confirmPayment(sessionId).subscribe({
      next: (res) => {
        this.isVerifyingPayment.set(false);
        this.authService.setSession(res.data);
        this.paymentSuccessMessage.set(res.message);

        // Clean query parameters from URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { session_id: null, success: null, plan: null },
          queryParamsHandling: 'merge'
        });

        // Clear toast after 6 seconds
        setTimeout(() => {
          this.paymentSuccessMessage.set(null);
        }, 6000);
      },
      error: (err) => {
        this.isVerifyingPayment.set(false);
        console.error('Failed to confirm payment upgrade', err);
        alert('Payment verification failed. If you completed checkout, please refresh or contact support.');
      }
    });
  }

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

  upgradePlan(plan: 'PREMIUM' | 'ULTIMATE') {
    this.billingService.createCheckoutSession(plan).subscribe({
      next: (res) => {
        if (res.data?.checkoutUrl) {
          window.location.href = res.data.checkoutUrl;
        }
      },
      error: (err) => {
        console.error('Failed to switch plan', err);
        alert('Failed to switch subscription plan.');
      }
    });
  }
}
