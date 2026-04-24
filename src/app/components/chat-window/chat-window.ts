import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; 
import { ChatInputComponent } from '../chat-input/chat-input';
import { SidebarComponent } from '../sidebar/sidebar';
import { ChatService } from '../../services/chat';
import { Subscription } from 'rxjs'; 
import { NavRailComponent } from '../nav-rail/nav-rail';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatInputComponent, SidebarComponent, NavRailComponent],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  messages: any[] = [];
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

  @HostListener('window:focus')
  onWindowFocus() {
    if (this.selectedUser) {
      this.markMessagesAsSeen();
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserId = Number(localStorage.getItem('userId'));
    }

    this.chatService.selectedUser$.subscribe(selection => {
      if (selection) {
        this.selectedUser = selection;
        this.messages = []; 
        
        if (this.currentUserId && !selection.isGroup) {
          this.loadRoomAndHistory(this.currentUserId, selection.id);
        } else if (selection.isGroup) {
          this.currentRoomId = selection.id; 
          this.chatService.subscribeToRoom(this.currentRoomId!); 

          this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
            this.messages = history.map(msg => {
              // --- BULLETPROOF INTERCEPTOR ---
              if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true; 
                msg.content = Number(msg.senderId) === Number(this.currentUserId) 
                    ? "You created this group." 
                    : "You were added to this group.";
              }

              if (Array.isArray(msg.timestamp)) {
                 msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
              }
              return msg;
            });
            setTimeout(() => this.scrollToBottom(), 100);
            this.listenToMessages(); 
            this.cdr.detectChanges();
          });
        }
      } else {
        this.selectedUser = null;
      }
      this.cdr.detectChanges();
    });
  }

  loadRoomAndHistory(user1Id: number, user2Id: number) {
    this.chatService.getOrCreateRoom(user1Id, user2Id).subscribe(room => {
      if (room && room.id) {
        this.currentRoomId = room.id.toString();
        
        if (this.roomSubscription) {
          this.roomSubscription.unsubscribe();
        }

        this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
          this.messages = history.map(msg => {
            if (msg.senderName === 'System' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true;
                msg.content = Number(msg.senderId) === Number(this.currentUserId) ? "You created this chat." : msg.content;
            }

            if (Array.isArray(msg.timestamp)) {
               msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
            }
            return msg;
          });
          
          this.markMessagesAsSeen();
          setTimeout(() => this.scrollToBottom(), 100);
          this.cdr.detectChanges();
        });

        this.chatService.subscribeToRoom(this.currentRoomId!);
        this.listenToMessages(); 
      }
    });
  }

  listenToMessages() {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
    }

    this.roomSubscription = this.chatService.getMessages().subscribe(msg => {
      if (msg && String(msg.roomId) === String(this.currentRoomId)) {
        
        if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
            msg.isSystem = true; 
            msg.content = Number(msg.senderId) === Number(this.currentUserId) 
                ? "You created this group." 
                : "You were added to this group.";
        }

        if (Array.isArray(msg.timestamp)) {
           msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
        }

        this.ngZone.run(() => {
          const exists = this.messages.some(m => m.id === msg.id);
          if (!exists) {
            this.messages.push(msg);

            if (msg.senderId !== this.currentUserId && !this.selectedUser?.isGroup) {
              if (document.hasFocus()) {
                this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'SEEN');
                msg.seen = true;
              } else {
                this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'DELIVERED');
              }
            }

            if (this.isUserAtBottom || msg.senderId === this.currentUserId) {
              setTimeout(() => this.scrollToBottom(), 50);
            } else {
              this.newMessagesCount++;
            }
            this.cdr.detectChanges();
          }
        });
      }
    });

    this.chatService.getReceipts().subscribe(receipt => {
      if (receipt && String(receipt.roomId) === String(this.currentRoomId)) {
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
      }
    });
  }

  markMessagesAsSeen() {
    if (!this.currentRoomId || !this.currentUserId || this.selectedUser?.isGroup) return; 
    
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
    try {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
        this.isUserAtBottom = true;
        this.newMessagesCount = 0;
      }
    } catch(err) {}
  }

  // chat-window.component.ts mein parseProfilePicture function add karein
parseProfilePicture(path: string) {
  if (!path) return { isImage: false, isAvatar: false };

  // Agar path '/uploads/' se shuru hota hai, toh image link hai
  if (path.startsWith('/uploads/')) {
    return { 
      isImage: true, 
      url: `http://localhost:8080${path}` 
    };
  }

  // Agar pipe '|' hai, toh predefined avatar classes hain
  if (path.includes('|')) {
    const parts = path.split('|');
    return { 
      isImage: false, 
      isAvatar: true, 
      bg: parts[0], 
      icon: parts[1] 
    };
  }

  return { isImage: false, isAvatar: false };
}
}