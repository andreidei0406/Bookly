import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [],
  templateUrl: './auth-callback.html',
  styleUrl: './auth-callback.scss'
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    // The backend set the HttpOnly cookies and redirected here.
    // The auth.service constructor called `checkSession()`, which will authenticate the user.
    // We can simply redirect to the dashboard.
    this.router.navigate(['/dashboard']);
  }
}
