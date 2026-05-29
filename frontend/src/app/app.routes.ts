import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing/landing').then(m => m.LandingComponent),
    pathMatch: 'full'
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
    redirectTo: 'dashboard/calendar',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/calendar',
    loadComponent: () => import('./features/dashboard/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard],
    data: { tab: 'calendar' }
  },
  {
    path: 'dashboard/bookings',
    loadComponent: () => import('./features/dashboard/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard],
    data: { tab: 'bookings' }
  },
  {
    path: 'dashboard/settings',
    loadComponent: () => import('./features/dashboard/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard],
    data: { tab: 'profile' }
  },
  {
    path: 'booking/:username',
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
    path: 'booking/:id/guest-cancel',
    loadComponent: () => import('./features/booking/guest-cancel.component').then(m => m.GuestCancelComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  }
];
