import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';
import { AvailabilityService, AvailableSlot } from '../../../core/services/availability.service';
import { BookingService } from '../../../core/services/booking.service';

type BookingStep = 'select-time' | 'enter-details' | 'confirmed';

interface TimeSlot {
  start: Date;
  end: Date;
}

@Component({
  selector: 'app-booking-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './booking-page.html',
  styleUrl: './booking-page.scss'
})
export class BookingPageComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private availabilityService = inject(AvailabilityService);
  private bookingService = inject(BookingService);

  host = signal<User | null>(null);
  
  username = signal('');
  meetingNameFromUrl = signal('Meeting');
  durationFromUrl = signal(30);

  hostName = computed(() => {
    const h = this.host();
    if (!h) return 'Loading...';
    return `${h.firstName} ${h.lastName}`;
  });
  
  meetingTypeName = computed(() => this.meetingNameFromUrl());
  duration = computed(() => this.durationFromUrl());
  timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // State
  step = signal<BookingStep>('select-time');
  
  // Calendar state
  currentMonth = signal(new Date());
  selectedDate = signal<Date | null>(null);
  selectedSlot = signal<TimeSlot | null>(null);
  
  // Form state
  guestName = signal('');
  guestEmail = signal('');
  notes = signal('');
  isSubmitting = signal(false);

  // Available days fetched from backend (YYYY-MM-DD)
  availableDays = signal<Set<string>>(new Set());

  // Generate calendar days for the current month view
  calendarDays = computed(() => {
    const year = this.currentMonth().getFullYear();
    const month = this.currentMonth().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null, isSelectable: false });
    }
    // Days of current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const isPast = date < today;
      
      const offset = date.getTimezoneOffset();
      const validDate = new Date(date.getTime() - (offset*60*1000));
      const dateStr = validDate.toISOString().split('T')[0];
      
      const hasAvailability = this.availableDays().has(dateStr);

      days.push({ 
        date, 
        isSelectable: !isPast && hasAvailability 
      });
    }
    return days;
  });

  // Fetched from backend
  availableSlots = signal<TimeSlot[]>([]);

  constructor() {
    // Get username from route
    const usernameParam = this.route.snapshot.paramMap.get('username');
    if (usernameParam) {
      this.username.set(usernameParam);
    }
    
    // Read meeting name and duration from query params
    const meetingParam = this.route.snapshot.queryParamMap.get('meeting');
    if (meetingParam) {
      this.meetingNameFromUrl.set(decodeURIComponent(meetingParam));
    }
    const durationParam = this.route.snapshot.queryParamMap.get('duration');
    if (durationParam) {
      const parsed = parseInt(durationParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.durationFromUrl.set(parsed);
      }
    }

    if (this.username()) {
      this.authService.getPublicProfile(this.username()).subscribe({
        next: (res) => {
          this.host.set(res.data);
          this.fetchAvailableDaysForMonth(this.currentMonth());
        },
        error: (err) => {
          console.error('Host not found', err);
          this.router.navigate(['/']);
        }
      });
    }
  }

  fetchAvailableDaysForMonth(date: Date) {
    if (!this.username()) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;
    
    this.availabilityService.getAvailableDays(this.username(), monthStr).subscribe({
      next: (res) => {
        this.availableDays.set(new Set(res.data));
      },
      error: (err) => {
        console.error('Failed to fetch available days', err);
        this.availableDays.set(new Set());
      }
    });
  }

  previousMonth() {
    const newMonth = new Date(this.currentMonth());
    newMonth.setMonth(newMonth.getMonth() - 1);
    this.currentMonth.set(newMonth);
    this.fetchAvailableDaysForMonth(this.currentMonth());
  }

  nextMonth() {
    const newMonth = new Date(this.currentMonth());
    newMonth.setMonth(newMonth.getMonth() + 1);
    this.currentMonth.set(newMonth);
    this.fetchAvailableDaysForMonth(this.currentMonth());
  }

  fetchAvailableSlots(date: Date) {
    if (!this.username()) return;

    // Format date to YYYY-MM-DD correctly using local timezone
    const offset = date.getTimezoneOffset()
    const validDate = new Date(date.getTime() - (offset*60*1000))
    const dateStr = validDate.toISOString().split('T')[0];

    this.availabilityService.getAvailableSlots(this.username(), dateStr, this.duration()).subscribe({
      next: (res) => {
        const slots: TimeSlot[] = res.data.map(slot => {
          const start = new Date(`${dateStr}T${slot.startTime}:00`);
          const end = new Date(`${dateStr}T${slot.endTime}:00`);
          return { start, end };
        });
        this.availableSlots.set(slots);
      },
      error: (err) => {
        console.error('Failed to fetch slots', err);
        this.availableSlots.set([]);
      }
    });
  }

  selectDate(day: { date: Date | null, isSelectable: boolean }) {
    if (!day.date || !day.isSelectable) return;
    this.selectedDate.set(day.date);
    this.selectedSlot.set(null); // reset slot
    this.fetchAvailableSlots(day.date);
  }

  selectSlot(slot: TimeSlot) {
    this.selectedSlot.set(slot);
  }

  continueToDetails() {
    if (this.selectedSlot()) {
      this.step.set('enter-details');
    }
  }

  goBackToTime() {
    this.step.set('select-time');
  }

  async submitBooking() {
    const slot = this.selectedSlot();
    const hostUser = this.username();

    if (!this.guestName() || !this.guestEmail() || !slot || !hostUser) return;
    
    this.isSubmitting.set(true);

    // Ensure double digits
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Format date and time
    const dateStr = slot.start.getFullYear() + '-' + pad(slot.start.getMonth() + 1) + '-' + pad(slot.start.getDate());
    const startTimeStr = pad(slot.start.getHours()) + ':' + pad(slot.start.getMinutes());

    const payload = {
      hostUsername: hostUser,
      guestName: this.guestName(),
      guestEmail: this.guestEmail(),
      meetingName: this.meetingTypeName(),
      duration: this.duration(),
      date: dateStr,
      startTime: startTimeStr,
      notes: this.notes()
    };

    this.bookingService.publicCreateBooking(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.step.set('confirmed');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Failed to create booking', err);
        alert('Failed to book this slot. It might no longer be available.');
      }
    });
  }
}
