import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent implements OnInit {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  
  errorMsg = '';
  isSubmitting = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.registerForm.patchValue({ email: params['email'] });
      }
    });
  }


  registerForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(1)]],
    lastName: ['', [Validators.required, Validators.minLength(1)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [
      Validators.required, 
      Validators.minLength(8),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    ]]
  });

  hasMinLength(): boolean {
    const pwd = this.registerForm.get('password')?.value || '';
    return pwd.length >= 8;
  }

  hasCaseMix(): boolean {
    const pwd = this.registerForm.get('password')?.value || '';
    return /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  }

  hasNumberAndSpecial(): boolean {
    const pwd = this.registerForm.get('password')?.value || '';
    return /\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);
  }

  onSubmit() {
    if (this.registerForm.invalid) return;
    
    this.isSubmitting = true;
    this.errorMsg = '';
    
    this.authService.register(this.registerForm.value).subscribe({
      error: (err) => {
        this.errorMsg = err.error?.error || err.error?.message || 'Registration failed. Check that your password contains 8+ characters with uppercase, lowercase, number, and special character.';
        this.isSubmitting = false;
      }
    });
  }

  loginWithGoogle() {
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  }
}
