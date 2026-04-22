import { Component, OnInit, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; 
import { ChatInputComponent } from '../chat-input/chat-input';
import { SidebarComponent } from '../sidebar/sidebar';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatInputComponent, SidebarComponent],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit {
  messages: any[] = [];
  currentUser = 'sanskriti';
  currentUserId: number | null = null;
  selectedUser: any = null;
  isUserAtBottom = true; // Track user position
  newMessagesCount = 0;   // Badge counter

  constructor(
    private chatService: ChatService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUser = localStorage.getItem('username') || 'sanskriti';
      this.currentUserId = Number(localStorage.getItem('userId'));
    }

    // Selected user ka data listen karo
    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user;
      if (user) {
        this.messages = []; // Optional: Naye user par chat clear karne ke liye
      }
    });

    // Messages listen karo aur Receipts bhejo
    this.chatService.getMessages().subscribe(msg => {
      if (msg) {
        this.ngZone.run(() => {
          // Naya message add karne se pehle check karein ki duplicate toh nahi (id based)
          const index = this.messages.findIndex(m => m.id === msg.id);
          if (index !== -1) {
              this.messages[index] = msg; // Update existing
          } else {
              this.messages = [...this.messages, msg]; // Add new
          }
          
          // NAYA LOGIC: Agar message kisi aur user ka hai, toh turant DELIVERED receipt bhejo
          const senderName = msg.senderUsername || msg.sender?.username;
          console.log('Current:', this.currentUser, 'Sender:', senderName);
          if (msg.senderId !== this.currentUserId && msg.id) {
              this.chatService.sendReceipt('1', msg.id, 'DELIVERED');
            }

          if (this.isUserAtBottom) {
            // Agar user niche hai, toh automatic scroll karo
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            // Agar user upar hai, toh counter badhao
            this.newMessagesCount++;
          }
          this.cdr.detectChanges();
        });
      }
    });

    // NAYA SUBSCRIPTION: Real-time Ticks Update Logic
    this.chatService.getReceipts().subscribe(receipt => {
      if (receipt) {
        this.ngZone.run(() => {
          // Find the message in our local array and update its status
          const msgIndex = this.messages.findIndex(m => m.id === receipt.messageId);
          if (msgIndex !== -1) {
            if (receipt.status === 'DELIVERED') {
              this.messages[msgIndex].delivered = true;
            } else if (receipt.status === 'SEEN') {
              this.messages[msgIndex].delivered = true;
              this.messages[msgIndex].seen = true;
            }
            this.cdr.detectChanges(); // UI Update trigger karein
          }
        });
      }
    });
  }

  // Scroll event listener jo HTML se call hoga
  onScroll(event: any) {
    const element = event.target;
    const threshold = 100; // kitna gap allowed hai bottom se
    // Check if user is near bottom
    this.isUserAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    if (this.isUserAtBottom) {
      this.newMessagesCount = 0; // Agar user niche aa gaya, badge reset kar do
    }
  }

  scrollToBottom() {
    if (isPlatformBrowser(this.platformId)) {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        this.newMessagesCount = 0;
        this.isUserAtBottom = true;
      }
    }
  }
}