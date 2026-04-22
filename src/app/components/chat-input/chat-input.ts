import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.scss'
})
export class ChatInputComponent {
  @Input() roomId: string | null = null; // NAYA: Room ID parent se aayegi
  messageText: string = '';

  constructor(private chatService: ChatService) {}

  sendMessage() {
    if (this.messageText.trim() && this.roomId) {
      const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      
      const messagePayload = {
        content: this.messageText,
        sender: { id: Number(currentUserId) },
        chatRoom: { id: Number(this.roomId) } // NAYA: Actual Room ID
      };

      this.chatService.sendMessage(this.roomId, messagePayload);
      this.messageText = ''; 
    }
  }
}