import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; 
import { ChatInputComponent } from '../chat-input/chat-input';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatInputComponent],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit {
  messages: any[] = [];
  currentUser = 'sanskriti'; 

  constructor(
    private chatService: ChatService,
    @Inject(PLATFORM_ID) private platformId: Object // SSR crash se bachne ke liye
  ) {}

  ngOnInit() {
    this.chatService.getMessages().subscribe(msg => {
      if (msg) {
        // Spread operator use karna best practice hai UI refresh ke liye
        this.messages = [...this.messages, msg];
        this.scrollToBottom();
      }
    });
  }

  private scrollToBottom() {
    // Ye check karega ki code browser mein chal raha hai ya server pe
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const container = document.querySelector('.messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }
}