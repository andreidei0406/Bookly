import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex flex-col overflow-hidden bg-background">
      <!-- Dynamic radial gradient background -->
      <div class="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(59,130,246,0.12),transparent)]"></div>

      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full z-10">
        <div class="flex items-center gap-8">
          <div class="flex items-center gap-2 cursor-pointer" routerLink="/">
            <div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-md">
              <span class="text-white font-bold text-lg leading-none">B</span>
            </div>
            <span class="font-bold text-xl text-gray-900 tracking-tight">Bookly</span>
          </div>
          <nav class="hidden md:flex gap-6">
            <a routerLink="/pricing" class="text-sm font-medium text-gray-900 transition-colors">Pricing</a>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <ng-container *ngIf="!currentUser()">
            <a routerLink="/login" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Log in</a>
            <a routerLink="/register" class="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors shadow-sm">Get Started</a>
          </ng-container>
          <ng-container *ngIf="currentUser()">
            <a routerLink="/dashboard" class="text-sm font-medium bg-brand-600 text-white px-4 py-2 rounded-full hover:bg-brand-700 transition-colors shadow-sm">Go to Dashboard</a>
          </ng-container>
        </div>
      </header>

      <!-- Pricing Section -->
      <main class="flex-grow py-20 px-4 z-10">
        <div class="max-w-7xl mx-auto">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p class="mt-4 text-xl text-gray-600">
              No hidden fees. No surprise charges. Choose the plan that works best for you and your team.
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <!-- Free Tier -->
            <div class="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 class="text-xl font-semibold text-gray-900">Basic</h3>
              <p class="mt-4 text-sm text-gray-500 flex-grow">
                Perfect for individuals just getting started with scheduling.
              </p>
              <div class="my-6">
                <span class="text-4xl font-extrabold text-gray-900">$0</span>
                <span class="text-base font-medium text-gray-500">/month</span>
              </div>
              <ul class="space-y-4 mb-8">
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">1 Active Calendar</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">1 Event Type</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Unlimited Bookings</span>
                </li>
              </ul>
              <a routerLink="/register" class="mt-auto w-full inline-flex justify-center rounded-xl border border-brand-600 bg-transparent px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors">
                Get Started Free
              </a>
            </div>

            <!-- Pro Tier (Popular) -->
            <div class="rounded-3xl border-2 border-brand-500 bg-white p-8 shadow-xl flex flex-col relative transform md:-translate-y-4">
              <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white tracking-wide uppercase">
                Most Popular
              </div>
              <h3 class="text-xl font-semibold text-gray-900">Professional</h3>
              <p class="mt-4 text-sm text-gray-500 flex-grow">
                Advanced features for professionals and growing businesses.
              </p>
              <div class="my-6">
                <span class="text-4xl font-extrabold text-gray-900">$12</span>
                <span class="text-base font-medium text-gray-500">/month</span>
              </div>
              <ul class="space-y-4 mb-8">
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Up to 6 Active Calendars</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Unlimited Event Types</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Stripe Integration</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Google Meet Integration</span>
                </li>
              </ul>
              <a routerLink="/register" class="mt-auto w-full inline-flex justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm">
                Start 14-Day Trial
              </a>
            </div>

            <!-- Teams Tier -->
            <div class="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 class="text-xl font-semibold text-gray-900">Teams</h3>
              <p class="mt-4 text-sm text-gray-500 flex-grow">
                For teams who need to route meetings and manage members.
              </p>
              <div class="my-6">
                <span class="text-4xl font-extrabold text-gray-900">$20</span>
                <span class="text-base font-medium text-gray-500">/user/month</span>
              </div>
              <ul class="space-y-4 mb-8">
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Everything in Pro</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Round Robin Routing</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Team Insights & Reporting</span>
                </li>
                <li class="flex items-start">
                  <svg class="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="ml-3 text-sm text-gray-700">Admin Controls</span>
                </li>
              </ul>
              <a routerLink="/register" class="mt-auto w-full inline-flex justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  `
})
export class PricingComponent {
  authService = inject(AuthService);
  currentUser = this.authService.currentUser;
}
