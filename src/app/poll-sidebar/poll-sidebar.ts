import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  loadPolls() {
    if (!this.currentUserId) return;
    this.chatService.getPollsForUser(this.currentUserId).subscribe({
      next: (polls) => {
        this.allPolls = polls;
        // Active tab ke liye filter: Poll active ho aur abhi expire na hua ho
        this.activePolls = polls.filter(p => p.active && new Date(p.expiryDate).getTime() > new Date().getTime());
        this.cdr.detectChanges();
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
    return this.allPolls.filter(poll => poll.createdBy === this.currentUserId).length;
  }
  
  

}