import { Component, OnInit, signal, computed, ViewChild, ElementRef, inject } from '@angular/core';
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
import { SettingsComponent } from '../settings/settings.component';
import { BookingsListComponent } from '../bookings/bookings-list.component';
import { environment } from '../../../../environments/environment';
import { forkJoin, zip, from, firstValueFrom } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

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
  
  // Track unsaved blocks
  unsavedBlocks = signal<any[]>([]);

  bookingUrl = computed(() => {
    const user = this.currentUser() as any;
    if (!user || !user.memberships || user.memberships.length === 0) return '';
    const slug = user.memberships[0].business?.slug || user.memberships[0].businessId;
    let url = `${window.location.origin}/booking/${slug}`;
    const name = this.meetingName().trim();
    if (name) {
      url += `?meeting=${encodeURIComponent(name)}`;
    }
    return url;
  });

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
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
    // Session is already fetched by app initializer, signal has data
  }

  fetchEvents(info: any, successCallback: Function, failureCallback: Function) {
    const user = this.currentUser() as any;
    if (!user?.memberships || user.memberships.length === 0) {
      successCallback([]);
      return;
    }
    const businessId = user.memberships[0].businessId;
    
    this.isFetching.set(true);

    zip(
      this.availabilityService.getBlocks(businessId, info.startStr, info.endStr),
      this.integrationService.getGoogleEvents(info.startStr, info.endStr)
    ).subscribe({
      next: ([blocksRes, googleRes]) => {
        const events = [];
        
        if (blocksRes.data) {
          events.push(...blocksRes.data.map((block: any) => ({
            id: block.id,
            title: 'Available',
            start: `${block.date.split('T')[0]}T${block.startTime}:00`,
            end: `${block.date.split('T')[0]}T${block.endTime}:00`,
            backgroundColor: '#3b82f6',
            borderColor: '#2563eb',
            extendedProps: { status: 'available', type: 'block' }
          })));
        }
        
        if (googleRes.data) {
          events.push(...googleRes.data.map((ge: any) => ({
            id: ge.id,
            title: ge.title,
            start: ge.start,
            end: ge.end,
            backgroundColor: 'rgba(254, 202, 202, 0.8)', // red-200 with 0.8 opacity
            borderColor: '#f87171', // red-400
            textColor: '#991b1b', // red-800
            editable: false,
            extendedProps: { status: 'busy', type: 'google' }
          })));
        }
        
        // Also add any unsaved blocks
        const unsaved = this.unsavedBlocks();
        events.push(...unsaved.map(block => ({
          id: block.id,
          title: 'Unsaved Slot',
          start: `${block.date}T${block.startTime}:00`,
          end: `${block.date}T${block.endTime}:00`,
          backgroundColor: '#93c5fd',
          borderColor: '#60a5fa',
          extendedProps: { status: 'unsaved', type: 'block' }
        })));
        
        successCallback(events);
        this.isFetching.set(false);
      },
      error: (err) => {
        console.error('Failed to load events', err);
        failureCallback(err);
        this.isFetching.set(false);
      }
    });
  }

  handleDateSelect(selectInfo: any) {
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
      backgroundColor: '#93c5fd',
      borderColor: '#60a5fa',
      extendedProps: { status: 'unsaved', type: 'block' }
    });

    this.unsavedBlocks.update(blocks => [...blocks, { id, date, startTime, endTime, action: 'create' }]);
  }

  handleEventClick(clickInfo: EventClickArg) {
    const event = clickInfo.event;
    this.selectedEvent.set({
      id: event.id,
      title: event.title,
      start: event.startStr,
      end: event.endStr,
      extendedProps: event.extendedProps
    });
  }

  handleEventDrop(dropInfo: any) {
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
  }

  handleEventResize(resizeInfo: any) {
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
  }

  saveChanges() {
    const blocks = this.unsavedBlocks();
    if (blocks.length === 0) return;
    
    const user = this.currentUser() as any;
    if (!user?.memberships || user.memberships.length === 0) return;
    const businessId = user.memberships[0].businessId;

    this.isSaving.set(true);

    from(blocks).pipe(
      concatMap(block => {
        if (block.action === 'update' && !block.id.startsWith('temp-')) {
          return this.availabilityService.updateBlock(businessId, block.id, block);
        } else {
          return this.availabilityService.createBlock(businessId, block);
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
        calendarApi.refetchEvents();
      },
      error: (err) => {
        console.error('Failed to save blocks', err);
        this.isSaving.set(false);
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
    calendarApi.refetchEvents();
  }

  clearAvailability() {
    const user = this.currentUser() as any;
    if (!user?.memberships || user.memberships.length === 0) return;
    const businessId = user.memberships[0].businessId;
    
    const calendarApi = this.calendarComponent.getApi();
    const info = calendarApi.view;
    
    if (confirm('Are you sure you want to clear all availability in this view?')) {
      this.isFetching.set(true);
      this.availabilityService.clearBlocks(businessId, info.activeStart.toISOString(), info.activeEnd.toISOString()).subscribe({
        next: () => {
          this.unsavedBlocks.set([]);
          calendarApi.refetchEvents();
        },
        error: (err) => {
          console.error('Failed to clear blocks', err);
          this.isFetching.set(false);
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
    
    const user = this.currentUser() as any;
    if (!user?.memberships || user.memberships.length === 0) return;
    const businessId = user.memberships[0].businessId;

    if (event.extendedProps.status === 'unsaved') {
      const calendarApi = this.calendarComponent.getApi();
      const ev = calendarApi.getEventById(event.id);
      if (ev) ev.remove();
      this.unsavedBlocks.update(blocks => blocks.filter(b => b.id !== event.id));
      calendarApi.refetchEvents();
      this.closeEventDialog();
      return;
    }

    if (confirm('Delete this availability block?')) {
      this.availabilityService.deleteBlock(businessId, event.id).subscribe({
        next: () => {
          this.calendarComponent.getApi().refetchEvents();
          this.closeEventDialog();
        },
        error: (err) => console.error('Failed to delete block', err)
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
