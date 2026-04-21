import { Component, OnInit, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
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
  isUserAtBottom = true; // Track user position
  newMessagesCount = 0;   // Badge counter

  constructor(
    private chatService: ChatService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.chatService.getMessages().subscribe(msg => {
      if (msg) {
        this.ngZone.run(() => {
          this.messages = [...this.messages, msg];
          
          if (this.isUserAtBottom) {
            // Agar user niche hai, toh automatic scroll karo
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            // Agar user upar hai, toh counter badhao
            this.newMessagesCount++;
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Scroll event listener jo HTML se call hoga
  onScroll(event: any) {
    const element = event.target;
    const threshold = 100; // kitna gap allowed hai bottom se
    // Check if user is near bottom
    this.isUserAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    if (this.isUserAtBottom) {
      this.newMessagesCount = 0; // Agar user niche aa gaya, badge reset kar do
    }
  }

  scrollToBottom() {
    if (isPlatformBrowser(this.platformId)) {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        this.newMessagesCount = 0;
        this.isUserAtBottom = true;
      }
    }
  }
}