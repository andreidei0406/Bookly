import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  
  errorMsg = '';
  isSubmitting = false;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;
    
    this.isSubmitting = true;
    this.errorMsg = '';
    
    this.authService.login(this.loginForm.value).subscribe({
      error: (err) => {
        this.errorMsg = err.error?.error || 'Invalid credentials';
        this.isSubmitting = false;
      }
    });
  }

  loginWithGoogle() {
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  }
}
