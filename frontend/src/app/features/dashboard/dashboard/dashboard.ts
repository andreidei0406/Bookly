import { Component, OnInit, signal, computed, ViewChild, ElementRef, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { IntegrationService } from '../../../core/services/integration.service';
import { BookingService } from '../../../core/services/booking.service';
import { SettingsComponent } from '../settings/settings.component';
import { BookingsListComponent } from '../bookings/bookings-list.component';
import { environment } from '../../../../environments/environment';
import { forkJoin, zip, from, firstValueFrom } from 'rxjs';
import { concatMap, toArray, catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

type DashboardTab = 'calendar' | 'bookings' | 'profile';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, SettingsComponent, BookingsListComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
  
  private authService = inject(AuthService);
  private availabilityService = inject(AvailabilityService);
  private integrationService = inject(IntegrationService);
  private bookingService = inject(BookingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  activeView = signal<DashboardTab>('calendar');
  currentDate = signal(new Date());
  showProfileDropdown = signal(false);
  isFetching = signal(false);
  isSaving = signal(false);
  
  currentUser = this.authService.currentUser;

  // Selected event for details dialog
  selectedEvent = signal<any | null>(null);
  showShareDialog = signal(false);
  linkCopied = signal(false);
  meetingName = signal('');
  meetingDuration = signal<number>(15);
  
  // Track unsaved blocks
  unsavedBlocks = signal<any[]>([]);

  bookingUrl = computed(() => {
    const user = this.currentUser() as any;
    if (!user) return '';
    const username = user.username;
    let url = `${window.location.origin}/booking/${username}`;
    const name = this.meetingName().trim();
    const duration = this.meetingDuration();
    
    url += `?duration=${duration}`;
    if (name) {
      url += `&meeting=${encodeURIComponent(name)}`;
    }
    return url;
  });

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    height: '100%',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    selectable: true,
    selectMirror: true,
    selectOverlap: true,
    eventOverlap: true,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:15:00',
    allDaySlot: false,
    editable: true,
    eventDurationEditable: true,
    events: this.fetchEvents.bind(this),
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    eventDrop: this.handleEventDrop.bind(this),
    eventResize: this.handleEventResize.bind(this),
  };

  ngOnInit() {
    // Read initial tab from route data
    const tab = this.route.snapshot.data['tab'] as DashboardTab;
    if (tab) {
      this.activeView.set(tab);
    }
  }

  fetchEvents(info: any, successCallback: Function, failureCallback: Function) {
    const user = this.currentUser() as any;
    if (!user) {
      successCallback([]);
      return;
    }
    
    this.isFetching.set(true);

    this.ngZone.run(() => {
      zip(
        this.availabilityService.getBlocks(info.startStr, info.endStr),
        this.integrationService.getGoogleEvents(info.startStr, info.endStr).pipe(
          catchError(() => from([{ data: [] }]))
        ),
        this.bookingService.getHostBookings('CONFIRMED').pipe(
          catchError(() => from([{ data: [] }]))
        )
      ).subscribe({
        next: ([blocksRes, googleRes, bookingsRes]: [any, any, any]) => {
          const events = [];
          
          if (blocksRes.data) {
            events.push(...blocksRes.data.map((block: any) => ({
              id: block.id,
              title: 'Available',
              start: `${block.date.split('T')[0]}T${block.startTime}:00`,
              end: `${block.date.split('T')[0]}T${block.endTime}:00`,
              classNames: ['cursor-pointer', 'available-event'],
              extendedProps: { status: 'available', type: 'block' }
            })));
          }

          // Extract googleEventIds from host bookings to prevent duplicate displaying of bookings
          const bookedGoogleEventIds = new Set<string>();
          if (bookingsRes.data) {
            bookingsRes.data.forEach((booking: any) => {
              if (booking.googleEventId) {
                bookedGoogleEventIds.add(booking.googleEventId);
              }
            });
          }
          
          if (googleRes.data) {
            // Filter out Google Calendar events that correspond to Bookly bookings
            const filteredGoogleEvents = googleRes.data.filter((ge: any) => !bookedGoogleEventIds.has(ge.id));
            events.push(...filteredGoogleEvents.map((ge: any) => ({
              id: ge.id,
              title: ge.title,
              start: ge.start,
              end: ge.end,
              editable: false,
              classNames: ['google-calendar-event', 'cursor-pointer'],
              extendedProps: { status: 'busy', type: 'google' }
            })));
          }

          if (bookingsRes.data) {
            events.push(...bookingsRes.data.map((booking: any) => ({
              id: booking.id,
              title: booking.guestName,
              start: `${booking.date.split('T')[0]}T${booking.startTime}:00`,
              end: `${booking.date.split('T')[0]}T${booking.endTime}:00`,
              editable: false,
              classNames: ['cursor-pointer', 'booked-event'],
              extendedProps: { status: 'booked', type: 'booking', booking }
            })));
          }
          
          // Also add any unsaved blocks
          const unsaved = this.unsavedBlocks();
          events.push(...unsaved.map(block => ({
            id: block.id,
            title: 'Unsaved Slot',
            start: `${block.date}T${block.startTime}:00`,
            end: `${block.date}T${block.endTime}:00`,
            classNames: ['cursor-pointer', 'unsaved-event'],
            extendedProps: { status: 'unsaved', type: 'block' }
          })));
          
          successCallback(events);
          this.isFetching.set(false);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load events', err);
          failureCallback(err);
          this.isFetching.set(false);
          this.cdr.detectChanges();
        }
      });
    });
  }

  handleDateSelect(selectInfo: any) {
    this.ngZone.run(() => {
      const calendarApi = selectInfo.view.calendar;
      calendarApi.unselect(); // clear date selection

      if (!selectInfo.startStr.includes('T') || !selectInfo.endStr.includes('T')) {
        console.warn('All-day selection not supported for availability blocks');
        return;
      }

      const date = selectInfo.startStr.split('T')[0];
      const startTime = selectInfo.startStr.split('T')[1].substring(0, 5);
      const endTime = selectInfo.endStr.split('T')[1].substring(0, 5);

      const id = `temp-${Date.now()}`;
      
      calendarApi.addEvent({
        id,
        title: 'Unsaved Slot',
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        classNames: ['cursor-pointer', 'unsaved-event'],
        extendedProps: { status: 'unsaved', type: 'block' }
      });

      this.unsavedBlocks.update(blocks => [...blocks, { id, date, startTime, endTime, action: 'create' }]);
      this.cdr.detectChanges();
    });
  }

  handleEventClick(clickInfo: EventClickArg) {
    this.ngZone.run(() => {
      const event = clickInfo.event;
      this.selectedEvent.set({
        id: event.id,
        title: event.title,
        start: event.startStr,
        end: event.endStr,
        extendedProps: event.extendedProps
      });
      this.cdr.detectChanges();
    });
  }

  handleEventDrop(dropInfo: any) {
    this.ngZone.run(() => {
      const event = dropInfo.event;
      if (event.extendedProps['status'] === 'busy') {
        dropInfo.revert();
        return;
      }
      
      const id = event.id;
      const date = dropInfo.event.startStr.split('T')[0];
      const startTime = dropInfo.event.startStr.split('T')[1].substring(0, 5);
      const endTime = dropInfo.event.endStr.split('T')[1].substring(0, 5);
      
      this.unsavedBlocks.update(blocks => {
        const existing = blocks.find(b => b.id === id);
        if (existing) {
          return blocks.map(b => b.id === id ? { ...b, date, startTime, endTime } : b);
        } else {
          return [...blocks, { id, date, startTime, endTime, action: 'update' }];
        }
      });
      this.cdr.detectChanges();
    });
  }

  handleEventResize(resizeInfo: any) {
    this.ngZone.run(() => {
      const event = resizeInfo.event;
      if (event.extendedProps['status'] === 'busy') {
        resizeInfo.revert();
        return;
      }
      
      const id = event.id;
      const date = resizeInfo.event.startStr.split('T')[0];
      const startTime = resizeInfo.event.startStr.split('T')[1].substring(0, 5);
      const endTime = resizeInfo.event.endStr.split('T')[1].substring(0, 5);
      
      this.unsavedBlocks.update(blocks => {
        const existing = blocks.find(b => b.id === id);
        if (existing) {
          return blocks.map(b => b.id === id ? { ...b, date, startTime, endTime } : b);
        } else {
          return [...blocks, { id, date, startTime, endTime, action: 'update' }];
        }
      });
      this.cdr.detectChanges();
    });
  }

  saveChanges() {
    const blocks = this.unsavedBlocks();
    if (blocks.length === 0) return;
    
    this.isSaving.set(true);

    from(blocks).pipe(
      concatMap(block => {
        if (block.action === 'update' && !block.id.startsWith('temp-')) {
          return this.availabilityService.updateBlock(block.id, block);
        } else {
          return this.availabilityService.createBlock(block);
        }
      }),
      toArray()
    ).subscribe({
      next: () => {
        this.isSaving.set(false);
        const calendarApi = this.calendarComponent.getApi();
        // Remove manually added temp events from calendar
        blocks.forEach(block => {
          if (block.action === 'create' || block.id.startsWith('temp-')) {
            const ev = calendarApi.getEventById(block.id);
            if (ev) ev.remove();
          }
        });
        this.unsavedBlocks.set([]);
        calendarApi.removeAllEvents();
        calendarApi.refetchEvents();
        calendarApi.render();
        this.calendarOptions = { ...this.calendarOptions };
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to save blocks', err);
        this.isSaving.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  discardChanges() {
    const calendarApi = this.calendarComponent.getApi();
    // Remove manually added temp events
    this.unsavedBlocks().forEach(block => {
      if (block.action === 'create' || block.id.startsWith('temp-')) {
        const ev = calendarApi.getEventById(block.id);
        if (ev) ev.remove();
      }
    });
    this.unsavedBlocks.set([]);
    calendarApi.removeAllEvents();
    calendarApi.refetchEvents();
    calendarApi.render();
    this.calendarOptions = { ...this.calendarOptions };
    this.cdr.detectChanges();
  }

  clearAvailability() {
    const calendarApi = this.calendarComponent.getApi();
    const info = calendarApi.view;
    
    if (confirm('Are you sure you want to clear all availability in this view?')) {
      this.isFetching.set(true);
      const startStr = info.activeStart.toLocaleDateString('sv-SE');
      const endStr = info.activeEnd.toLocaleDateString('sv-SE');
      
      this.availabilityService.clearBlocks(startStr, endStr).subscribe({
        next: () => {
          // Remove manually added temp events from calendar
          this.unsavedBlocks().forEach(block => {
            if (block.action === 'create' || block.id.startsWith('temp-')) {
              const ev = calendarApi.getEventById(block.id);
              if (ev) ev.remove();
            }
          });
          this.unsavedBlocks.set([]);
          calendarApi.removeAllEvents();
          calendarApi.refetchEvents();
          calendarApi.render();
          this.calendarOptions = { ...this.calendarOptions };
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to clear blocks', err);
          this.isFetching.set(false);
          this.cdr.detectChanges();
        }
      });
    }
  }

  refreshGoogleEvents() {
    this.calendarComponent.getApi().refetchEvents();
  }

  closeEventDialog() {
    this.selectedEvent.set(null);
  }

  deleteSelectedBlock() {
    const event = this.selectedEvent();
    if (!event) return;

    if (event.extendedProps.status === 'unsaved') {
      const calendarApi = this.calendarComponent.getApi();
      const ev = calendarApi.getEventById(event.id);
      if (ev) ev.remove();
      this.unsavedBlocks.update(blocks => blocks.filter(b => b.id !== event.id));
      calendarApi.removeAllEvents();
      calendarApi.refetchEvents();
      calendarApi.render();
      this.calendarOptions = { ...this.calendarOptions };
      this.closeEventDialog();
      this.cdr.detectChanges();
      return;
    }

    if (confirm('Delete this availability block?')) {
      this.availabilityService.deleteBlock(event.id).subscribe({
        next: () => {
          const calendarApi = this.calendarComponent.getApi();
          calendarApi.removeAllEvents();
          calendarApi.refetchEvents();
          calendarApi.render();
          this.calendarOptions = { ...this.calendarOptions };
          this.closeEventDialog();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to delete block', err);
          this.cdr.detectChanges();
        }
      });
    }
  }

  openShareDialog() {
    this.showShareDialog.set(true);
    this.linkCopied.set(false);
    this.meetingName.set('');
  }

  closeShareDialog() {
    this.showShareDialog.set(false);
  }

  copyLink() {
    navigator.clipboard.writeText(this.bookingUrl()).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  visitLink() {
    window.open(this.bookingUrl(), '_blank');
  }

  setView(view: DashboardTab) {
    this.activeView.set(view);
    this.showProfileDropdown.set(false);

    // Navigate to the matching route
    const routeMap: Record<DashboardTab, string> = {
      calendar: '/dashboard/calendar',
      bookings: '/dashboard/bookings',
      profile: '/dashboard/settings',
    };
    this.router.navigate([routeMap[view]], { replaceUrl: true });

    if (view === 'calendar' && this.calendarComponent) {
      setTimeout(() => {
        this.calendarComponent.getApi().render();
      }, 0);
    }
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
