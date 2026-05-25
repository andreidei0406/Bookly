import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing/landing').then(m => m.LandingComponent),
    pathMatch: 'full'
  },
  {
    path: 'pricing',
    loadComponent: () => import('./features/pricing/pricing.component').then(m => m.PricingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard]
  },
  {
    path: 'booking/:businessSlug',
    loadComponent: () => import('./features/booking/booking-page/booking-page.component').then(m => m.BookingPageComponent)
  },
  {
    path: 'booking/:id/success',
    loadComponent: () => import('./features/booking/booking-success.component').then(m => m.BookingSuccessComponent)
  },
  {
    path: 'booking/:id/cancel',
    loadComponent: () => import('./features/booking/booking-cancel.component').then(m => m.BookingCancelComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  }
];
