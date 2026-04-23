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
  groups: any[] = []; // NAYA: Groups store karne ke liye
  activeTab: 'chats' | 'groups' = 'chats'; // NAYA: Current active tab track karne ke liye
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

    // --- NAYA LOGIC: Nav Rail se tab switch sunne ke liye ---
    this.chatService.activeTab$.subscribe(tab => {
      this.activeTab = tab;
      this.activeUserId = null; // Tab badalne par selection hatao
      if (tab === 'groups') {
        this.loadGroups();
      }
      this.cdr.detectChanges();
    });

    this.loadUsers();

    this.chatService.sidebarUpdate$.subscribe(msg => {
      if (msg) {
        this.updateSidebarUI(msg);
      }
    });
  }

  // --- NAYA LOGIC: Dummy Groups Load karna (Jab tak backend na bane) ---
  loadGroups() {
    this.groups = [
      { id: 'g1', username: 'Project Alpha', lastMessage: 'Deploy complete!', unreadCount: 3, isGroup: true },
      { id: 'g2', username: 'Weekend Plan', lastMessage: 'See you at 6.', unreadCount: 0, isGroup: true }
    ];
  }

  // --- AAPKA PURANA SAFE LOGIC (As it is) ---
  updateSidebarUI(msg: any) {
    const currentId = Number(this.currentUserId);
    const msgSenderId = Number(msg.senderId);
    const activePartnerId = Number(this.activeUserId);

    const partnerId = (msgSenderId === currentId) ? activePartnerId : msgSenderId;
    const userIndex = this.users.findIndex(u => Number(u.id) === partnerId);

    if (userIndex !== -1) {
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

    this.http.get<any[]>('http://localhost:8080/api/users', { headers }).subscribe({
      next: (data) => {
        this.users = data.filter(user => user.username !== loggedInUser);
        
        this.users.forEach(user => {
          this.syncUserStatus(user);
        });

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Sidebar load error:', err)
    });
  }

  syncUserStatus(user: any) {
    if (!this.currentUserId) return;

    this.chatService.getOrCreateRoom(this.currentUserId, user.id).subscribe(room => {
      if (room && room.id) {
        const roomIdStr = room.id.toString();

        this.chatService.subscribeToRoom(roomIdStr);

        this.chatService.getChatHistory(roomIdStr).subscribe(history => {
          if (history && history.length > 0) {
            const lastMsg = history[history.length - 1];
            user.lastMessage = lastMsg.content;

            let validTime = lastMsg.timestamp;
            if (Array.isArray(lastMsg.timestamp)) {
              validTime = new Date(lastMsg.timestamp[0], lastMsg.timestamp[1] - 1, lastMsg.timestamp[2], lastMsg.timestamp[3], lastMsg.timestamp[4]).toISOString();
            }
            user.lastMessageTime = validTime;

            const unread = history.filter((m: any) => Number(m.senderId) !== Number(this.currentUserId) && !m.seen).length;
            user.unreadCount = unread;
          }
          this.sortUsersByTime();
          this.cdr.detectChanges();
        });
      }
    });
  }

  sortUsersByTime() {
    this.users.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA; 
    });
  }

  selectUser(user: any) {
    this.activeUserId = user.id;
    user.unreadCount = 0; 
    this.chatService.selectUser(user);
    this.cdr.detectChanges();
  }
}