import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

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
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  errorMsg = '';
  isSubmitting = false;
  fieldErrors: Record<string, string> = {};

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
    this.fieldErrors = {};
    
    this.authService.register(this.registerForm.value).subscribe({
      next: (res) => {
        // tap handles navigation
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isSubmitting = false;
          const errorData = err.error;
          
          if (errorData) {
            if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
              // Zod Validation failure
              this.errorMsg = errorData.message || 'Validation failed';
              errorData.errors.forEach((e: any) => {
                const fieldName = e.field.replace('body.', '');
                this.fieldErrors[fieldName] = e.message;
              });
            } else if (err.status === 409) {
              // Conflict (e.g. Email exists)
              const msg = errorData.message || 'A user with this email already exists';
              this.errorMsg = msg;
              if (msg.toLowerCase().includes('email')) {
                this.fieldErrors['email'] = msg;
              } else if (msg.toLowerCase().includes('username')) {
                this.fieldErrors['username'] = msg;
              }
            } else {
              this.errorMsg = errorData.message || 'Registration failed. Please try again.';
            }
          } else {
            this.errorMsg = 'Failed to connect to the authentication service. Please check your network.';
          }
          
          // Force change detection immediately
          this.cdr.detectChanges();
        });
      }
    });
  }

  loginWithGoogle() {
    window.location.href = `${environment.apiUrl}/v1/auth/google`;
  }
}
