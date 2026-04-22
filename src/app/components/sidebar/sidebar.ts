import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  users: any[] = [];
  activeUserId: any = null;
  currentUserId: number | null = null;

  constructor(
    private http: HttpClient, 
    private cdr: ChangeDetectorRef,
    private chatService: ChatService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserId = Number(localStorage.getItem('userId'));
    }

    this.loadUsers();

    // Live update listener
    this.chatService.sidebarUpdate$.subscribe(msg => {
      if (msg) {
        this.updateSidebarUI(msg);
      }
    });
  }

  updateSidebarUI(msg: any) {
    const currentId = Number(this.currentUserId);
    const msgSenderId = Number(msg.senderId);
    const activePartnerId = Number(this.activeUserId);

    const partnerId = (msgSenderId === currentId) ? activePartnerId : msgSenderId;
    const userIndex = this.users.findIndex(u => Number(u.id) === partnerId);

    if (userIndex !== -1) {
      // Live Unread Count
      if (msgSenderId !== currentId && partnerId !== activePartnerId) {
        this.users[userIndex].unreadCount = (this.users[userIndex].unreadCount || 0) + 1;
      }

      this.users[userIndex].lastMessage = msg.content;
      
      let validTime = msg.timestamp;
      if (Array.isArray(msg.timestamp)) {
        validTime = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
      }
      this.users[userIndex].lastMessageTime = validTime || new Date().toISOString();

      const updatedUser = { ...this.users[userIndex] };
      const remainingUsers = this.users.filter(u => Number(u.id) !== partnerId);
      this.users = [updatedUser, ...remainingUsers];

      this.cdr.detectChanges();
    }
  }

  loadUsers() {
    let loggedInUser = '';
    let token = '';

    if (isPlatformBrowser(this.platformId)) {
      loggedInUser = localStorage.getItem('username') || '';
      token = localStorage.getItem('token') || '';
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // 1. Pehle users mangwao
    this.http.get<any[]>('http://localhost:8080/api/users', { headers }).subscribe({
      next: (data) => {
        this.users = data.filter(user => user.username !== loggedInUser);
        
        // // --- NAYA LOGIC: App open hote hi purani history se Data Hydrate karo ---
        // this.users.forEach(user => {
        //   this.hydrateOfflineData(user);
        // });

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Sidebar load error:', err)
    });
  }

  // NAYA FUNCTION: Backend history check karke offline count nikalna
  // hydrateOfflineData(user: any) {
  //   if (!this.currentUserId) return;

  //   // Room dhoondo
  //   this.chatService.getOrCreateRoom(this.currentUserId, user.id).subscribe(room => {
  //     if (room && room.id) {
  //       // Us room ki history mangwao
  //       this.chatService.getChatHistory(room.id.toString()).subscribe(history => {
  //         if (history && history.length > 0) {
            
  //           // 1. Last Message aur Time set karo
  //           const lastMsg = history[history.length - 1];
  //           user.lastMessage = lastMsg.content;

  //           let validTime = lastMsg.timestamp;
  //           if (Array.isArray(lastMsg.timestamp)) {
  //             validTime = new Date(lastMsg.timestamp[0], lastMsg.timestamp[1] - 1, lastMsg.timestamp[2], lastMsg.timestamp[3], lastMsg.timestamp[4]).toISOString();
  //           }
  //           user.lastMessageTime = validTime;

  //           // 2. Unread Count nikalo (Jo messages saamne wale ne bheje hain aur 'seen' = false hai)
  //           const unreadCount = history.filter((m: any) => m.senderId !== this.currentUserId && !m.seen).length;
  //           user.unreadCount = unreadCount;
  //         } else {
  //           user.unreadCount = 0;
  //         }

  //         // 3. User ko time ke hisaab se sort karo taaki naye messages upar aayen
  //         this.sortUsersByTime();
  //         this.cdr.detectChanges();
  //       });
  //     }
  //   });
  // }

  // NAYA FUNCTION: Sidebar ko sort karne ke liye
  // sortUsersByTime() {
  //   this.users.sort((a, b) => {
  //     const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
  //     const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
  //     return timeB - timeA; // Jo sabse naya hai wo Top par aayega
  //   });
  // }

  selectUser(user: any) {
    this.activeUserId = user.id;
    user.unreadCount = 0; // Chat open karte hi count zero
    this.chatService.selectUser(user);
    this.cdr.detectChanges();
  }
}