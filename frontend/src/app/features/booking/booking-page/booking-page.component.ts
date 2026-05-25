import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { BusinessService, BusinessDetails, ServiceType } from '../../../core/services/business.service';
import { BookingService, AvailableSlot } from '../../../core/services/booking.service';

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
  private businessService = inject(BusinessService);
  private bookingService = inject(BookingService);

  business = signal<BusinessDetails | null>(null);
  selectedService = signal<ServiceType | null>(null);
  meetingNameFromUrl = signal('');

  hostName = computed(() => this.business()?.name || 'Loading...');
  meetingTypeName = computed(() => {
    const fromUrl = this.meetingNameFromUrl();
    if (fromUrl) return fromUrl;
    return this.selectedService()?.name || 'Meeting';
  });
  duration = computed(() => this.selectedService()?.duration || 30);
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
      // Mock availability: assume Mon-Fri are available
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      days.push({ 
        date, 
        isSelectable: !isPast && !isWeekend 
      });
    }
    return days;
  });

  // Fetched from backend
  availableSlots = signal<TimeSlot[]>([]);

  constructor() {
    // Get slug from route
    const slug = this.route.snapshot.paramMap.get('businessSlug');
    
    // Read meeting name from query params
    const meetingParam = this.route.snapshot.queryParamMap.get('meeting');
    if (meetingParam) {
      this.meetingNameFromUrl.set(decodeURIComponent(meetingParam));
    }

    if (slug) {
      this.businessService.getBusinessBySlug(slug).subscribe({
        next: (res) => {
          this.business.set(res.data);
          if (res.data.services.length > 0) {
            this.selectedService.set(res.data.services[0]); // default to first service
          }
        },
        error: (err) => {
          console.error('Business not found', err);
          this.router.navigate(['/']);
        }
      });
    }
  }

  previousMonth() {
    const newMonth = new Date(this.currentMonth());
    newMonth.setMonth(newMonth.getMonth() - 1);
    this.currentMonth.set(newMonth);
  }

  nextMonth() {
    const newMonth = new Date(this.currentMonth());
    newMonth.setMonth(newMonth.getMonth() + 1);
    this.currentMonth.set(newMonth);
  }

  fetchAvailableSlots(date: Date) {
    const businessId = this.business()?.id;
    const serviceId = this.selectedService()?.id;
    if (!businessId || !serviceId) return;

    // Format date to YYYY-MM-DD correctly using local timezone
    const offset = date.getTimezoneOffset()
    const validDate = new Date(date.getTime() - (offset*60*1000))
    const dateStr = validDate.toISOString().split('T')[0];

    this.bookingService.getAvailableSlots(businessId, serviceId, dateStr).subscribe({
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
    const businessId = this.business()?.id;
    const serviceId = this.selectedService()?.id;
    const slot = this.selectedSlot();

    if (!this.guestName() || !this.guestEmail() || !slot || !businessId || !serviceId) return;
    
    this.isSubmitting.set(true);

    // Ensure double digits
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Format date and time
    const dateStr = slot.start.getFullYear() + '-' + pad(slot.start.getMonth() + 1) + '-' + pad(slot.start.getDate());
    const startTimeStr = pad(slot.start.getHours()) + ':' + pad(slot.start.getMinutes());

    const payload = {
      businessId,
      serviceId,
      guestName: this.guestName(),
      guestEmail: this.guestEmail(),
      date: dateStr,
      startTime: startTimeStr,
      notes: this.notes()
    };

    this.bookingService.publicCreateBooking(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if ((res.data as any)['checkoutUrl']) {
          window.location.href = (res.data as any)['checkoutUrl'];
        } else {
          this.step.set('confirmed');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Failed to create booking', err);
        alert('Failed to book this slot. It might no longer be available.');
      }
    });
  }
}
