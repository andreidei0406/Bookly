import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth';

type ViewMode = 'calendar' | 'profile';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  duration: number;
  color: string;
  customerName: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private authService = inject(AuthService);

  activeView = signal<ViewMode>('calendar');
  currentDate = signal(new Date());
  selectedDate = signal<Date | null>(null);
  showProfileDropdown = signal(false);

  currentUser = this.authService.currentUser;

  // Calendar view mode: month or week
  calendarMode = signal<'month' | 'week'>('month');

  // Current month/year label
  monthYearLabel = computed(() => {
    const d = this.currentDate();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Sample events for demo
  private sampleEvents: CalendarEvent[] = [
    { id: '1', title: 'Haircut', time: '09:00', duration: 30, color: '#4CAF50', customerName: 'Jane Doe' },
    { id: '2', title: 'Hair Coloring', time: '10:00', duration: 90, color: '#FF9800', customerName: 'John Smith' },
    { id: '3', title: 'Full Styling', time: '14:00', duration: 60, color: '#9C27B0', customerName: 'Alice Brown' },
    { id: '4', title: 'Beard Trim', time: '16:00', duration: 15, color: '#2196F3', customerName: 'Bob Wilson' },
  ];

  // Build calendar grid
  calendarDays = computed<CalendarDay[]>(() => {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-start: getDay() returns 0 for Sunday
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: CalendarDay[] = [];
    const today = new Date();

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(year, month, day);
      const isToday = d.toDateString() === today.toDateString();

      // Sprinkle sample events on certain days for demo
      let events: CalendarEvent[] = [];
      if (day === today.getDate() && month === today.getMonth()) {
        events = this.sampleEvents.slice(0, 3);
      } else if (day === today.getDate() + 1 && month === today.getMonth()) {
        events = [this.sampleEvents[0], this.sampleEvents[3]];
      } else if (day === today.getDate() + 3 && month === today.getMonth()) {
        events = [this.sampleEvents[2]];
      }

      days.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        events,
      });
    }

    // Fill remaining cells to complete 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }

    return days;
  });

  // Selected day events
  selectedDayEvents = computed(() => {
    const sel = this.selectedDate();
    if (!sel) return [];
    const days = this.calendarDays();
    const day = days.find(d => d.date.toDateString() === sel.toDateString());
    return day?.events ?? [];
  });

  selectedDateLabel = computed(() => {
    const sel = this.selectedDate();
    if (!sel) return 'Select a day';
    return sel.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  ngOnInit() {
    // Auto-select today
    this.selectedDate.set(new Date());
  }

  setView(view: ViewMode) {
    this.activeView.set(view);
    this.showProfileDropdown.set(false);
  }

  prevMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  goToToday() {
    this.currentDate.set(new Date());
    this.selectedDate.set(new Date());
  }

  selectDay(day: CalendarDay) {
    this.selectedDate.set(day.date);
  }

  isSelected(day: CalendarDay): boolean {
    const sel = this.selectedDate();
    if (!sel) return false;
    return day.date.toDateString() === sel.toDateString();
  }

  toggleProfileDropdown() {
    this.showProfileDropdown.update(v => !v);
  }

  logout() {
    this.authService.logout().subscribe();
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    return (user.firstName?.[0] || '') + (user.lastName?.[0] || '');
  }
}
