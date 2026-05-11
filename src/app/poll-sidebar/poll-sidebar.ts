import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-poll-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './poll-sidebar.html',
  styleUrl: './poll-sidebar.scss'
})
export class PollSidebarComponent {
  activeFilter: 'all' | 'active' = 'all';

  // Dummy Polls Data matching your UI request
  polls = [
    { id: 1, title: 'Q3 Product Roadmap', expiry: 'Expires in 2h 45m', status: 'Active', icon: 'bi-map', bg: 'bg-purple' },
    { id: 2, title: 'Team Outing Destination', expiry: 'Expires in 1d', status: 'Active', icon: 'bi-geo-alt', bg: 'bg-green' },
    { id: 3, title: 'New UI Theme Feedback', expiry: 'Expired 2d ago', status: 'Closed', icon: 'bi-palette', bg: 'bg-pink' },
    { id: 4, title: 'Weekly Meeting Time', expiry: 'Expires in 5h', status: 'Active', icon: 'bi-clock', bg: 'bg-blue' },
    { id: 5, title: 'Hackathon Ideas', expiry: 'Expired 1w ago', status: 'Closed', icon: 'bi-lightbulb', bg: 'bg-orange' }
  ];

  get filteredPolls() {
    if (this.activeFilter === 'active') return this.polls.filter(p => p.status === 'Active');
    return this.polls;
  }
}