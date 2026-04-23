import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatService } from '../../services/chat';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  users: any[] = [];
  groups: any[] = []; 
  activeTab: 'chats' | 'groups' = 'chats'; 
  activeUserId: any = null;
  currentUserId: number | null = null;

  showCreateGroupModal: boolean = false;
  newGroupName: string = '';
  selectedUsersForGroup: number[] = [];

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

    this.chatService.activeTab$.subscribe(tab => {
      this.activeTab = tab;
      this.activeUserId = null; 
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

  // --- NAYA LOGIC: Fetch & Auto-Subscribe ---
  loadGroups() {
    if (!this.currentUserId) return;
    
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any[]>(`http://localhost:8080/api/groups/user/${this.currentUserId}`, { headers })
      .subscribe({
        next: (data) => {
          // 1. Group IDs ko 'GROUP_' prefix do taaki User ID se mix na ho
          this.groups = data.map(g => ({
            ...g,
            originalId: g.id,
            id: `GROUP_${g.id}`, 
            isGroup: true
          }));

          // 2. Load hote hi saare groups ke WebSocket rooms se jud jao!
          this.groups.forEach(g => {
            this.chatService.subscribeToRoom(g.id);
          });

          this.cdr.detectChanges();
        },
        error: (err) => console.error("Error loading groups:", err)
      });
  }

  openCreateGroupModal() {
    this.showCreateGroupModal = true;
    this.newGroupName = '';
    this.selectedUsersForGroup = [];
  }

  closeCreateGroupModal() {
    this.showCreateGroupModal = false;
  }

  toggleUserSelection(userId: number) {
    const index = this.selectedUsersForGroup.indexOf(userId);
    if (index > -1) {
      this.selectedUsersForGroup.splice(index, 1);
    } else {
      this.selectedUsersForGroup.push(userId);
    }
  }

  createGroup() {
    if (this.newGroupName.trim() === '' || this.selectedUsersForGroup.length === 0) {
      alert("Please enter a group name and select at least one member.");
      return;
    }

    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload = {
      name: this.newGroupName,
      memberIds: this.selectedUsersForGroup
    };

    this.http.post<any>(`http://localhost:8080/api/groups/create?creatorId=${this.currentUserId}`, payload, { headers })
      .subscribe({
        next: (response) => {
          this.closeCreateGroupModal();
          this.loadGroups(); 
        },
        error: (err) => {
          console.error("Error creating group:", err);
          alert("Failed to create group.");
        }
      });
  }

  // =======================================================
  // AAPKA PURANA SAFE LOGIC (100% UNTOUCHED + GROUP INTERCEPTOR)
  // =======================================================

  updateSidebarUI(msg: any) {
    // --- NAYA: GROUP MESSAGE INTERCEPTOR ---
    // Agar msg.roomId 'GROUP_' se shuru hota hai, toh iska matlab ye group message hai
    if (msg.roomId && String(msg.roomId).startsWith('GROUP_')) {
      const groupIndex = this.groups.findIndex(g => g.id === String(msg.roomId));
      
      if (groupIndex !== -1) {
        // Agar main us group mein abhi chat nahi kar raha, aur message maine nahi bheja, tabhi badge badhao
        if (Number(msg.senderId) !== Number(this.currentUserId) && String(this.activeUserId) !== String(msg.roomId)) {
          this.groups[groupIndex].unreadCount = (this.groups[groupIndex].unreadCount || 0) + 1;
        }
        
        this.groups[groupIndex].lastMessage = msg.content;
        this.cdr.detectChanges();
      }
      return; // YAHAN SE FUNCTION ROK DO! Neeche wala 1-on-1 logic run nahi hoga.
    }

    // --- AAPKA ORIGINAL 1-ON-1 LOGIC ---
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