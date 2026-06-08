import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styles: ``
})
export class LandingComponent {
  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;
}
