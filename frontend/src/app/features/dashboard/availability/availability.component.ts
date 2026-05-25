import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvailabilityService, WorkingHours } from '../../../core/services/availability.service';
import { AuthService } from '../../../core/services/auth.service';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">Availability</h2>
          <p class="text-sm text-muted-foreground mt-1">Set your weekly recurring schedule</p>
        </div>
        <button 
          (click)="save()" 
          [disabled]="isSaving()"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
          <svg *ngIf="isSaving()" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {{ isSaving() ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

      <div *ngIf="isLoading()" class="flex justify-center p-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <div *ngIf="!isLoading()" class="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div class="p-6 space-y-6">
          <div *ngFor="let entry of hours(); let i = index" class="flex flex-col sm:flex-row items-center gap-4 py-4 border-b border-border last:border-0">
            
            <div class="w-full sm:w-40 flex items-center gap-3">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" [checked]="!entry.isClosed" (change)="toggleDay(i)" class="sr-only peer">
                <div class="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
              <span class="font-medium" [class.text-muted-foreground]="entry.isClosed">{{ formatDay(entry.dayOfWeek) }}</span>
            </div>

            <div class="flex-1 flex items-center gap-4" [class.opacity-50]="entry.isClosed" [class.pointer-events-none]="entry.isClosed">
              <div class="flex items-center gap-2">
                <input 
                  type="time" 
                  [(ngModel)]="entry.openTime"
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              </div>
              <span class="text-muted-foreground">-</span>
              <div class="flex items-center gap-2">
                <input 
                  type="time" 
                  [(ngModel)]="entry.closeTime"
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              </div>
            </div>
            
            <div *ngIf="entry.isClosed" class="w-24 text-sm text-muted-foreground italic text-right">
              Unavailable
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AvailabilityComponent implements OnInit {
  private availabilityService = inject(AvailabilityService);
  private authService = inject(AuthService);

  hours = signal<WorkingHours[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  businessId = signal<string | null>(null);

  ngOnInit() {
    this.initDefaultHours();
    
    // Attempt to get the user's business ID
    const user = this.authService.currentUser() as any;
    if (user && user.memberships && user.memberships.length > 0) {
      this.businessId.set(user.memberships[0].businessId);
      this.loadHours();
    } else {
      this.isLoading.set(false);
      console.error('No business associated with user');
    }
  }

  initDefaultHours() {
    const defaultHours = DAYS.map(day => ({
      dayOfWeek: day,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: day === 'SATURDAY' || day === 'SUNDAY'
    }));
    this.hours.set(defaultHours);
  }

  loadHours() {
    const bId = this.businessId();
    if (!bId) return;

    this.availabilityService.getWorkingHours(bId).subscribe({
      next: (res) => {
        if (res.data && res.data.length > 0) {
          // Merge with default days to ensure all 7 days exist
          const merged = DAYS.map(day => {
            const existing = res.data.find(h => h.dayOfWeek === day);
            return existing || {
              dayOfWeek: day,
              openTime: '09:00',
              closeTime: '17:00',
              isClosed: true
            };
          });
          this.hours.set(merged);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load hours', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleDay(index: number) {
    this.hours.update(h => {
      const updated = [...h];
      updated[index].isClosed = !updated[index].isClosed;
      return updated;
    });
  }

  formatDay(day: string): string {
    return day.charAt(0) + day.slice(1).toLowerCase();
  }

  save() {
    const bId = this.businessId();
    if (!bId) {
      alert('No business ID found.');
      return;
    }

    this.isSaving.set(true);
    this.availabilityService.updateWorkingHours(bId, this.hours()).subscribe({
      next: () => {
        this.isSaving.set(false);
        alert('Availability saved successfully!');
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Failed to save', err);
        alert('Failed to save availability.');
      }
    });
  }
}
