import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
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
  
  errorMsg = signal('');
  isSubmitting = signal(false);
  showAccountNotFound = signal(false);
  submittedEmail = signal('');

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;
    
    this.isSubmitting.set(true);
    this.errorMsg.set('');
    this.showAccountNotFound.set(false);
    this.submittedEmail.set(this.loginForm.value.email || '');
    
    this.authService.login(this.loginForm.value).subscribe({
      error: (err) => {
        this.isSubmitting.set(false);
        if (err?.status === 404) {
          this.showAccountNotFound.set(true);
        } else {
          this.errorMsg.set(err?.error?.message || err?.error?.error || 'Invalid credentials');
        }
      }
    });
  }

  closeModal() {
    this.showAccountNotFound.set(false);
  }

  loginWithGoogle() {
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  }
}
