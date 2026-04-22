import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; 
import { ChatInputComponent } from '../chat-input/chat-input';
import { SidebarComponent } from '../sidebar/sidebar';
import { ChatService } from '../../services/chat';
import { Subscription } from 'rxjs'; 

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatInputComponent, SidebarComponent],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  messages: any[] = [];
  currentUser = 'sanskriti';
  currentUserId: number | null = null;
  selectedUser: any = null;
  currentRoomId: string | null = null; 
  isUserAtBottom = true; 
  newMessagesCount = 0;   
  private roomSubscription: Subscription | null = null; 

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

    // Sidebar se user select hone par dynamic room dhoondo
    this.chatService.selectedUser$.subscribe(user => {
      if (user && this.currentUserId) {
        this.selectedUser = user;
        this.messages = []; // Pehle screen clean karo
        
        // Purane room se pehle disconnect karein
        if (this.currentRoomId) {
          console.log('Cleaning up room:', this.currentRoomId);
        }

        this.chatService.getOrCreateRoom(this.currentUserId, user.id).subscribe(room => {
          if (room && room.id) {
            this.currentRoomId = room.id.toString();
            
            // 1. Fresh WebSocket subscription
            this.chatService.subscribeToRoom(this.currentRoomId!);
            
            // 2. NAYA LOGIC: Chat History Load Karo
            this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
              this.messages = history; // DB se aayi history set karo
              
              // Load hote hi scroll niche le jao taaki latest message dikhe
              setTimeout(() => this.scrollToBottom(), 100);
              this.cdr.detectChanges();
            });
            
          }
        });
      } else {
        this.selectedUser = null;
        this.currentRoomId = null;
      }
    });

    // Naye messages aane par handle karo
    this.chatService.getMessages().subscribe(msg => {
      if (msg) {
        this.ngZone.run(() => {
          const index = this.messages.findIndex(m => m.id === msg.id);
          if (index !== -1) {
              this.messages[index] = msg;
          } else {
              this.messages = [...this.messages, msg];
          }
          
          // Receipt sirf tab bhejo jab hum us room mein hain
          if (msg.senderId !== this.currentUserId && msg.id && this.currentRoomId) {
              this.chatService.sendReceipt(this.currentRoomId, msg.id, 'DELIVERED');
          }

          if (this.isUserAtBottom) {
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            this.newMessagesCount++;
          }
          this.cdr.detectChanges();
        });
      }
    });

    // Ticks (Receipts) update karo
    this.chatService.getReceipts().subscribe(receipt => {
      if (receipt) {
        this.ngZone.run(() => {
          const msgIndex = this.messages.findIndex(m => m.id === receipt.messageId);
          if (msgIndex !== -1) {
            if (receipt.status === 'DELIVERED') {
              this.messages[msgIndex].delivered = true;
            } else if (receipt.status === 'SEEN') {
              this.messages[msgIndex].delivered = true;
              this.messages[msgIndex].seen = true;
            }
            this.cdr.detectChanges();
          }
        });
      }
    });
  }
 
  ngOnDestroy() {
    // Component band hote hi sab clean up karein
    if (this.roomSubscription) this.roomSubscription.unsubscribe();
  }

  onScroll(event: any) {
    const element = event.target;
    this.isUserAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    if (this.isUserAtBottom) this.newMessagesCount = 0;
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