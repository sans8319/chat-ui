import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { ChatService } from '../services/chat';

@Component({
  selector: 'app-poll-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './poll-sidebar.html',
  styleUrl: './poll-sidebar.scss'
})
export class PollSidebarComponent implements OnInit {
  activeFilter: 'all' | 'active' = 'all';
  currentUserId: number | null = null;
  selectedPollId: number | null = null;
  
  allPolls: any[] = [];
  activePolls: any[] = [];

  allFetchedPolls: any[] = [];
  

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUserId = Number(localStorage.getItem('userId'));
    this.loadPolls();

    // 🛑 Real-time WebSocket Listener
    this.chatService.notificationUpdate$.subscribe(notif => {
    if (notif && (notif.type === 'NEW_POLL' || notif.type === 'VOTE_SUBMITTED')) {
      setTimeout(() => {
        this.loadPolls();
      }, 800);
    }
  });
  }

  applyFilters() {
    // Pehle sirf wo polls lo jo is user ke liye targeted hain
    let basePolls = this.allFetchedPolls.filter(p => p.targetedForUser);

    // Agar date select ki gayi hai, toh date ke hisaab se list choti (filter) karo
    if (this.selectedFilterDate) {
      basePolls = basePolls.filter(p => {
        if (!p.createdAt) return false;
        const d = new Date(p.createdAt);
        // Date ko YYYY-MM-DD format mein convert karke match karo
        const pollDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return pollDateStr === this.selectedFilterDate;
      });
    }

    // Filtered data ko main arrays me daal do (HTML apne aap update ho jayega)
    this.allPolls = basePolls;
    this.activePolls = this.allPolls.filter(p => p.active && new Date(p.expiryDate).getTime() > new Date().getTime());
    
    this.cdr.detectChanges();
  }

  loadPolls() {
    if (!this.currentUserId) return;
    this.chatService.getPollsForUser(this.currentUserId).subscribe({
      next: (polls) => {
        this.allFetchedPolls = polls; 
        this.applyFilters(); // 🛑 NAYA: Direct filter function call karega
      },
      error: (err) => console.error("Error fetching polls", err)
    });
  }

  getCreatorName(poll: any): string {
    if (Number(poll.createdBy) === this.currentUserId) {
      return 'by You';
    }
    
    return poll.createdByUsername ? `by ${poll.createdByUsername}` : `by User ${poll.createdBy}`; 
  }

  getExpiryStatus(expiryDateStr: string): string {
    if (!expiryDateStr) return 'No expiry set';
    
    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;
    
    const oneHour = 1000 * 60 * 60;
    const oneDay = oneHour * 24;

    if (diff > 0) {
      // Chal raha hai
      if (diff > oneDay) {
        const days = Math.floor(diff / oneDay);
        return `Expiring in ${days} day${days > 1 ? 's' : ''}`;
      } else if (diff > oneHour) {
        const hours = Math.floor(diff / oneHour);
        return `Expiring in ${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        const mins = Math.floor(diff / (1000 * 60));
        return `Expiring in ${mins} min${mins > 1 ? 's' : ''}`;
      }
    } else {
      // Expire ho chuka hai
      const pastDiff = Math.abs(diff);
      if (pastDiff > oneDay) {
        const days = Math.floor(pastDiff / oneDay);
        return `Expired ${days} day${days > 1 ? 's' : ''} ago`;
      } else if (pastDiff > oneHour) {
        const hours = Math.floor(pastDiff / oneHour);
        return `Expired ${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const mins = Math.floor(pastDiff / (1000 * 60));
        return `Expired ${mins} min${mins > 1 ? 's' : ''} ago`;
      }
    }
  }

  isPollActive(poll: any): boolean {
    return poll.active && !this.getExpiryStatus(poll.expiryDate).includes('Expired');
  }

  // UI ko premium dikhane ke liye dynamic icon generator (Based on ID)
  getIconData(pollId: number) {
    const icons = ['bi-bar-chart-fill', 'bi-pie-chart-fill', 'bi-ui-radios', 'bi-list-check', 'bi-patch-question-fill'];
    const bgs = ['bg-purple', 'bg-green', 'bg-blue', 'bg-pink', 'bg-orange'];
    const index = (pollId || 0) % 5;
    return { icon: icons[index], bg: bgs[index] };
  }

  selectPoll(poll: any) {
    this.selectedPollId = poll.id; 
    this.chatService.setSelectedPoll(poll); // Ye right side ko data bhej dega
    this.chatService.setShowMyPolls(false); // 🛑 FIX: Grid view ko band karo
  }

  // 🛑 NAYA FUNCTION: Create Poll window open karne ke liye
  openCreatePoll() {
    this.selectedPollId = null; // Sidebar ke card se active glow/highlight hata dega
    this.chatService.setSelectedPoll(null); // Right side ko signal dega ki "Create Poll" form dikhao
    this.chatService.setShowMyPolls(false); // 🛑 FIX: Grid view ko band karo
  }

  openMyCreatedPolls() {
    this.selectedPollId = -1; // Kisi card ka glow na rahe
    this.chatService.setSelectedPoll(null); // Create poll hide karein
    this.chatService.setShowMyPolls(true); // Grid view show karein
  }
  
  // poll-sidebar.ts mein loadPolls ke neeche ya kahin bhi add karein
  get myCreatedPollsCount(): number {
    // 🛑 Ab count saare fetched polls mein se nikalo, naa ki sirf targeted ones mein se
    return this.allFetchedPolls.filter(poll => poll.createdBy === this.currentUserId).length;
  }
  
  // 🛑 NAYA: Filter & Custom Calendar Variables
  showFilterMenu: boolean = false;
  showCalendar: boolean = false;
  selectedFilterDate: string | null = null;
  
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  calendarDays: any[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Screen par kahin click ho to menu band ho jaye
  @HostListener('document:click')
  closePopups() {
    this.showFilterMenu = false;
    this.showCalendar = false;
  }

  toggleFilter(event: Event) {
    event.stopPropagation();
    
    // 🛑 FIX: Agar filter pehle se laga hai, toh icon click karne par reset ho jayega!
    if (this.selectedFilterDate) {
      this.selectedFilterDate = null;
      this.showFilterMenu = false;
      this.showCalendar = false;
      this.applyFilters(); // Wapas saare polls dikhayega
    } else {
      // Agar filter nahi laga hai, toh menu open/close hoga
      this.showFilterMenu = !this.showFilterMenu;
      this.showCalendar = false;
    }
  }

  toggleCalendar(event: Event) {
    event.stopPropagation();
    this.showCalendar = !this.showCalendar;
    if(this.showCalendar && this.calendarDays.length === 0) {
        this.generateCalendar();
    }
  }

  generateCalendar() {
    this.calendarDays = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth - 1, daysInPrevMonth - i);
      this.calendarDays.push({ date: d.getDate(), isCurrentMonth: false, fullDate: this.formatDate(d) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(this.currentYear, this.currentMonth, i);
      this.calendarDays.push({ date: i, isCurrentMonth: true, fullDate: this.formatDate(d) });
    }
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(this.currentYear, this.currentMonth + 1, i);
      this.calendarDays.push({ date: i, isCurrentMonth: false, fullDate: this.formatDate(d) });
    }
  }

  formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  prevMonth(event: Event) {
    event.stopPropagation();
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; } 
    else { this.currentMonth--; }
    this.generateCalendar();
  }

  nextMonth(event: Event) {
    event.stopPropagation();
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; } 
    else { this.currentMonth++; }
    this.generateCalendar();
  }

  selectDate(fullDate: string, event: Event) {
    event.stopPropagation();
    this.selectedFilterDate = fullDate;
    this.showCalendar = false;
    this.showFilterMenu = false;
    
    // 🛑 FIX: Date select hote hi polls filter ho jayenge
    this.applyFilters(); 
  }
  getMonthName(): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[this.currentMonth];
  }
  

}