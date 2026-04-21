import { Component, OnInit, ChangeDetectorRef,Inject, PLATFORM_ID} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule], // HttpClient yahan config se aayega
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  users: any[] = [];
  activeUserId: any = null;

  constructor(
  private http: HttpClient, 
  private cdr: ChangeDetectorRef,
  private chatService: ChatService,
  @Inject(PLATFORM_ID) private platformId: Object // Ye line add karein
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    let loggedInUser = '';
    if (isPlatformBrowser(this.platformId)) {
      loggedInUser = localStorage.getItem('username') || '';
    }
    // Backend API call
    this.http.get<any[]>('http://localhost:8080/api/users').subscribe({
      next: (data) => {
        this.users = data.filter(user => user.username !== loggedInUser);
        this.cdr.detectChanges();
        console.log('Users loaded:', this.users);
      },
      error: (err) => console.error('Sidebar error:', err)
    });
  }

  selectUser(user: any) {
  this.activeUserId = user.id;
  this.chatService.selectUser(user); // Service ko batao ki user select ho gaya
    console.log('Selected Chat with:', user.username);
  }
}