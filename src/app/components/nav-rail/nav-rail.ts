import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-nav-rail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss'
})
export class NavRailComponent implements OnInit {
  userInitial: string = '';
  activeTab: 'chats' | 'groups' | 'profile' = 'chats';// Default state

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const storedName = localStorage.getItem('username');
      if (storedName) {
        this.userInitial = storedName.charAt(0).toUpperCase();
      }
    }

    // Service se active tab ko listen karo
    this.chatService.activeTab$.subscribe(tab => {
      this.activeTab = tab;
    });
  }

  switchTab(tab: 'chats' | 'groups' | 'profile') {
    this.chatService.setActiveTab(tab);
  }
}