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

  // --- NAYE UI VARIABLES (Profile & Avatar ke liye space) ---
  newGroupDescription: string = '';
  memberSearchQuery: string = '';
  groupPermission: 'everyone' | 'admins' = 'everyone';
  
  // Interactive Avatar State
  selectedAvatarBg: string = '';
  selectedAvatarIcon: string = '';
  selectedAvatarImage: string | null = null; // Preview ke liye
  selectedFile: File | null = null;

  constructor(
    private http: HttpClient, 
    private cdr: ChangeDetectorRef,
    private chatService: ChatService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  get filteredUsersForGroup() {
    if (!this.memberSearchQuery.trim()) return this.users;
    return this.users.filter(u => 
      u.username.toLowerCase().includes(this.memberSearchQuery.toLowerCase())
    );
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserId = Number(localStorage.getItem('userId'));
    }

    this.chatService.activeTab$.subscribe(tab => {
      this.activeTab = tab;
      this.activeUserId = null; 
      this.loadGroups();
      this.cdr.detectChanges();
    });

    this.loadUsers();

    this.chatService.sidebarUpdate$.subscribe(msg => {
      if (msg) {
        this.updateSidebarUI(msg);
      }
    });

    this.chatService.notificationUpdate$.subscribe(notif => {
      if (notif) {
        if (notif.type === 'NEW_GROUP') {
          setTimeout(() => { this.loadGroups(); }, 800);
        }
        if (notif.type === 'NEW_USER') {
          setTimeout(() => { this.loadUsers(); }, 800);
        }
      }
    });
  }

  loadGroups() {
    if (!this.currentUserId) return;
    
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any[]>(`http://localhost:8080/api/groups/user/${this.currentUserId}`, { headers })
      .subscribe({
        next: (data) => {
          this.groups = data.map(g => ({
            ...g,
            originalId: g.id,
            id: `GROUP_${g.id}`, 
            isGroup: true,
            unreadCount: 0,
            lastMessage: 'Loading...',
            lastMessageTime: null
          }));

          this.groups.forEach(g => {
            this.chatService.subscribeToRoom(g.id);
            this.syncGroupStatus(g); 
          });

          this.cdr.detectChanges();
        },
        error: (err) => console.error("Error loading groups:", err)
      });
  }

  syncGroupStatus(group: any) {
    this.chatService.getChatHistory(group.id).subscribe(history => {
      if (history && history.length > 0) {
        const lastMsg = history[history.length - 1];

        const isSystemMsg = lastMsg.senderName === 'System' || lastMsg.content === 'You were added to this group.' || lastMsg.content === '###GROUP_CREATED###';
        
        if (isSystemMsg) {
          group.lastMessage = Number(lastMsg.senderId) === Number(this.currentUserId) 
              ? 'You created this group.' 
              : 'You were added to this group.';
        } else {
          group.lastMessage = lastMsg.content;
        }
        
        let validTime = lastMsg.timestamp;
        if (Array.isArray(lastMsg.timestamp)) {
          validTime = new Date(lastMsg.timestamp[0], lastMsg.timestamp[1] - 1, lastMsg.timestamp[2], lastMsg.timestamp[3], lastMsg.timestamp[4]).toISOString();
        }
        group.lastMessageTime = validTime;

        let lastReadStr = localStorage.getItem(`group_last_read_${group.id}`);
        if (!lastReadStr) {
            const latest = validTime ? new Date(validTime).getTime() : Date.now();
            lastReadStr = latest.toString();
            localStorage.setItem(`group_last_read_${group.id}`, lastReadStr);
        }
        const lastReadTime = Number(lastReadStr);

        const unread = history.filter((m: any) => {
          if (Number(m.senderId) === Number(this.currentUserId)) return false;

          let msgTime = 0;
          if (Array.isArray(m.timestamp)) {
             msgTime = new Date(m.timestamp[0], m.timestamp[1] - 1, m.timestamp[2], m.timestamp[3], m.timestamp[4]).getTime();
          } else if (m.timestamp) {
             msgTime = new Date(m.timestamp).getTime();
          }

          return msgTime > lastReadTime; 
        }).length;

        group.unreadCount = String(this.activeUserId) === String(group.id) ? 0 : unread;

      } else {
        group.lastMessage = 'Tap to start chatting...';
      }
      this.sortGroupsByTime();
      this.cdr.detectChanges();
    });
  }

  updateSidebarUI(msg: any) {
    if (msg.roomId && String(msg.roomId).startsWith('GROUP_')) {
      const groupIndex = this.groups.findIndex(g => g.id === String(msg.roomId));
      
      if (groupIndex !== -1) {
        let validTime = msg.timestamp;
        if (Array.isArray(msg.timestamp)) {
          validTime = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
        }
        this.groups[groupIndex].lastMessageTime = validTime || new Date().toISOString();

        if (Number(msg.senderId) !== Number(this.currentUserId) && String(this.activeUserId) !== String(msg.roomId)) {
          this.groups[groupIndex].unreadCount = (this.groups[groupIndex].unreadCount || 0) + 1;
        } else if (String(this.activeUserId) === String(msg.roomId)) {
          const msgTime = new Date(this.groups[groupIndex].lastMessageTime).getTime();
          localStorage.setItem(`group_last_read_${msg.roomId}`, msgTime.toString());
        }
        
        const isSystemMsg = msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###';
        
        if (isSystemMsg) {
          this.groups[groupIndex].lastMessage = Number(msg.senderId) === Number(this.currentUserId) 
              ? 'You created this group.' 
              : 'You were added to this group.';
        } else {
          this.groups[groupIndex].lastMessage = msg.content;
        }

        const updatedGroup = { ...this.groups[groupIndex] };
        const remainingGroups = this.groups.filter(g => g.id !== String(msg.roomId));
        this.groups = [updatedGroup, ...remainingGroups];

        this.cdr.detectChanges();
      } else {
        setTimeout(() => { this.loadGroups(); }, 800);
      }
      return; 
    }

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
    } else {
      setTimeout(() => { this.loadUsers(); }, 800);
    }
  }

  sortGroupsByTime() {
    this.groups.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA; 
    });
  }

  // --- UI RESET ON MODAL OPEN ---
  openCreateGroupModal() {
    this.showCreateGroupModal = true;
    this.newGroupName = '';
    this.selectedUsersForGroup = [];
    
    this.newGroupDescription = '';
    this.memberSearchQuery = '';
    this.groupPermission = 'everyone';
    this.selectedAvatarBg = '';
    this.selectedAvatarIcon = '';
    this.selectedAvatarImage = null; // NAYA
  this.selectedFile = null;
  }

  closeCreateGroupModal() {
    this.showCreateGroupModal = false;
  }

  // --- NAYA: Handle Avatar Selection ---
  selectPredefinedAvatar(bgClass: string, iconClass: string) {
    this.selectedAvatarBg = bgClass;
    this.selectedAvatarIcon = iconClass;
    this.selectedAvatarImage = null; // NAYA: Uploaded image preview hatao
  this.selectedFile = null;
  }

  // File upload trigger (UI only for now)
  triggerFileUpload() {
    
  }

  toggleUserSelection(userId: number) {
    const index = this.selectedUsersForGroup.indexOf(userId);
    if (index > -1) {
      this.selectedUsersForGroup.splice(index, 1);
    } else {
      this.selectedUsersForGroup.push(userId);
    }
  }

async createGroup() { 
  if (this.newGroupName.trim() === '' || this.selectedUsersForGroup.length === 0) {
    alert("Please enter a group name and select at least one member.");
    return;
  }

  // 1. Token sabse pehle nikaal lo taaki dono APIs mein use ho sake
  const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
  const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

  let finalImageUrl = '';

  // 2. Pehle Image Upload Karo
  if (this.selectedFile) {
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    try {
      // --- YAHAN FIX KIYA HAI: Upload API mein { headers } add kar diya ---
      const uploadRes: any = await this.http.post('http://localhost:8080/api/files/upload', formData, { headers }).toPromise();
      finalImageUrl = uploadRes.url; 
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image. Please check console.");
      return;
    }
  } else if (this.selectedAvatarBg) {
    finalImageUrl = `${this.selectedAvatarBg}|${this.selectedAvatarIcon}`;
  }
  
  // 3. Phir Group Create Karo
  const payload = { 
    name: this.newGroupName, 
    memberIds: this.selectedUsersForGroup,
    description: this.newGroupDescription,
    permissions: this.groupPermission,
    profilePicture: finalImageUrl 
  };

  this.http.post<any>(`http://localhost:8080/api/groups/create?creatorId=${this.currentUserId}`, payload, { headers })
    .subscribe({
      next: () => {
        this.closeCreateGroupModal();
        this.loadGroups(); 
      },
      error: (err) => {
        console.error("Group creation error:", err);
        alert("Failed to create group.");
      }
    });
}

  loadUsers() {
    let loggedInUser = '';
    let token = '';
    if (isPlatformBrowser(this.platformId)) {
      loggedInUser = localStorage.getItem('username') || '';
      token = localStorage.getItem('token') || '';
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.get<any[]>('http://localhost:8080/api/users', { headers }).subscribe({
      next: (data) => {
        this.users = data.filter(user => user.username !== loggedInUser);
        this.users.forEach(user => this.syncUserStatus(user));
        this.cdr.detectChanges();
      }
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
    
    if (user.isGroup || String(user.id).startsWith('GROUP_')) {
       const latestTime = user.lastMessageTime ? new Date(user.lastMessageTime).getTime() : Date.now();
       localStorage.setItem(`group_last_read_${user.id}`, latestTime.toString());
    }

    this.chatService.selectUser(user);
    this.cdr.detectChanges();
  }

  onFileSelected(event: any) {
  const file = event.target.files[0];
  if (file) {
    this.selectedFile = file;
    this.selectedAvatarBg = ''; // Predefined avatar hata do
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedAvatarImage = reader.result as string; // Preview dikhao
    };
    reader.readAsDataURL(file);
  }
}

// sidebar.ts mein add karein
parseProfilePicture(path: string) {
  if (!path) return { isImage: false, isAvatar: false };

  // Agar path '/uploads/' se shuru hota hai, toh woh image hai
  if (path.startsWith('/uploads/')) {
    return { 
      isImage: true, 
      url: `http://localhost:8080${path}` 
    };
  }

  // Agar path mein '|' hai, toh woh predefined avatar hai
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