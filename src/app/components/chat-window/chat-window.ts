import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
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

  // Jab user wapas tab par aaye, toh unread messages check karo
  @HostListener('window:focus')
  onWindowFocus() {
    if (isPlatformBrowser(this.platformId) && this.selectedUser) {
      this.markMessagesAsSeen();
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUser = localStorage.getItem('username') || 'sanskriti';
      this.currentUserId = Number(localStorage.getItem('userId'));
    }

    this.chatService.selectedUser$.subscribe(user => {
      if (user && this.currentUserId) {
        this.selectedUser = user;
        this.messages = []; 
        
        this.chatService.getOrCreateRoom(this.currentUserId, user.id).subscribe(room => {
          if (room && room.id) {
            this.currentRoomId = room.id.toString();
            this.chatService.subscribeToRoom(this.currentRoomId!);
            
            this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
              this.messages = history; 
              
              setTimeout(() => {
                this.scrollToBottom();
                // Chat khulte hi sab 'SEEN' mark karo
                this.markMessagesAsSeen();
              }, 100);
              this.cdr.detectChanges();
            });
          }
        });
      } else {
        this.selectedUser = null;
        this.currentRoomId = null;
        this.messages = [];
      }
    });

    this.chatService.getMessages().subscribe(msg => {
      if (msg) {
        this.ngZone.run(() => {
          const incomingRoomId = msg.roomId?.toString() || msg.chatRoom?.id?.toString();
          
          if (incomingRoomId === this.currentRoomId) {
            const index = this.messages.findIndex(m => m.id === msg.id);
            if (index !== -1) {
                this.messages[index] = msg;
            } else {
                this.messages = [...this.messages, msg];
            }

            // --- WHATSAPP MASTER LOGIC ---
            // Agar message doosre ne bheja hai AUR ye chat window abhi open hai
            if (msg.senderId !== this.currentUserId && msg.id) {
                console.log("Real-time SEEN triggered for room:", incomingRoomId);
                
                // Bina mouse/keyboard ka wait kiye SEEN bhejo kyunki window OPEN hai
                this.chatService.sendReceipt(incomingRoomId, msg.id, 'SEEN');
                
                // Local UI update
                msg.seen = true;
                msg.delivered = true;
            }
          } else {
             // Agar chat open NAHI hai, toh sirf DELIVERED (Grey Ticks) bhejo
             if (msg.senderId !== this.currentUserId && msg.id && incomingRoomId) {
               this.chatService.sendReceipt(incomingRoomId, msg.id, 'DELIVERED');
             }
          }

          if (this.isUserAtBottom && incomingRoomId === this.currentRoomId) {
            setTimeout(() => this.scrollToBottom(), 100);
          } else if (incomingRoomId === this.currentRoomId) {
            this.newMessagesCount++;
          }
          this.cdr.detectChanges();
        });
      }
    });

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

  markMessagesAsSeen() {
    if (!this.currentRoomId || !this.currentUserId) return;
    
    let needsUpdate = false;
    this.messages.forEach(msg => {
      if (msg.senderId !== this.currentUserId && !msg.seen) {
        this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'SEEN');
        msg.seen = true;
        msg.delivered = true;
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
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