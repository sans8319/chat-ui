import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../services/chat';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-nav-rail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss'
})
export class NavRailComponent implements OnInit {
  userInitial: string = '';
  activeTab: 'chats' | 'groups' | 'profile' = 'chats';
  loggedInProfilePicture: string = '';
  loggedInStatusColor: string = '#22c55e'; // Default Green
  currentUserId: number | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  getStatusColor(statusName: string) {
    const colors: any = {
      'Online': '#22c55e', 'Away': '#f59e0b', 'In a meeting': '#3b82f6',
      'On a call': '#8b5cf6', 'Do not disturb': '#ef4444', 'Offline': '#94a3b8'
    };
    return colors[statusName] || '#22c55e';
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserId = Number(localStorage.getItem('userId'));
      const storedName = localStorage.getItem('username');
      if (storedName) {
        this.userInitial = storedName.charAt(0).toUpperCase();
      }
      
      this.loggedInProfilePicture = localStorage.getItem('profilePicture') || '';
      this.loggedInStatusColor = localStorage.getItem('statusColor') || '#22c55e';

      // Storage khali ho toh DB se lao
      this.fetchUserInitialState();
    }

    this.chatService.activeTab$.subscribe(tab => {
      this.activeTab = tab;
    });

    this.chatService.profileUpdate$.subscribe(user => {
      if (user) {
        if (user.username) this.userInitial = user.username.charAt(0).toUpperCase();
        this.loggedInProfilePicture = user.profilePicture || '';
        this.loggedInStatusColor = user.customStatusColor || this.getStatusColor(user.statusState || 'Online');
        
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('statusColor', this.loggedInStatusColor);
          localStorage.setItem('profilePicture', this.loggedInProfilePicture);
        }
        this.cdr.detectChanges();
      }
    });
  }

  fetchUserInitialState() {
    if (!this.currentUserId) return;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(`http://localhost:8080/api/users/${this.currentUserId}`, { headers })
      .subscribe({
        next: (user) => {
          if (user) {
            this.loggedInProfilePicture = user.profilePicture || '';
            this.loggedInStatusColor = user.customStatusColor || this.getStatusColor(user.statusState || 'Online');
            localStorage.setItem('statusColor', this.loggedInStatusColor);
            this.cdr.detectChanges();
          }
        }
      });
  }

  switchTab(tab: 'chats' | 'groups' | 'profile') {
    this.chatService.setActiveTab(tab);
  }

  parseProfilePicture(path: string) {
    if (!path) return { isImage: false, isAvatar: false };
    if (path.startsWith('/uploads/')) return { isImage: true, url: `http://localhost:8080${path}` };
    if (path.includes('|')) {
      const parts = path.split('|');
      return { isImage: false, isAvatar: true, bg: parts[0], icon: parts[1] };
    }
    return { isImage: false, isAvatar: false };
  }
}