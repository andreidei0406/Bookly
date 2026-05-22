import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-booking-page',
  standalone: true,
  imports: [],
  templateUrl: './booking-page.html',
  styleUrl: './booking-page.scss'
})
export class BookingPageComponent {
  // State using Angular Signals
  selectedDate = signal<number | null>(null);
  selectedTime = signal<string | null>(null);

  availableTimes = signal<string[]>([
    '09:00', '09:30', '10:00', '10:30', 
    '11:00', '13:00', '14:30', '15:00', '16:00'
  ]);

  selectDate(date: number) {
    this.selectedDate.set(date);
    this.selectedTime.set(null); // Reset time when date changes
  }

  selectTime(time: string) {
    this.selectedTime.set(time);
  }
}
