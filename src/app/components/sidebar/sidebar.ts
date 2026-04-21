import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    // Backend API call
    this.http.get<any[]>('http://localhost:8080/api/users').subscribe({
      next: (data) => {
        this.users = data;
        console.log('Users loaded:', this.users);
      },
      error: (err) => console.error('Sidebar error:', err)
    });
  }

  selectUser(user: any) {
    this.activeUserId = user.id;
    console.log('Selected Chat with:', user.username);
  }
}