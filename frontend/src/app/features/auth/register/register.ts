import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  loginWithGoogle() {
    // Redirect to the backend Google OAuth endpoint
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  }
}
