import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Paths ko update karo:
import { SidebarComponent } from './components/sidebar/sidebar';
import { ChatWindowComponent } from './components/chat-window/chat-window';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ChatWindowComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'chat-ui';
}