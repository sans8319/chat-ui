import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms'; // <--- Binding ke liye zaroori
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule], // <--- Isse [(ngModel)] chalega
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.scss'
})
export class ChatInputComponent {
  messageText: string = '';

  constructor(private chatService: ChatService) {}

  sendMessage() {
    if (this.messageText.trim()) {
      const messagePayload = {
        content: this.messageText,
        sender: { username: 'sanskriti' }, // Hardcoded for now
        chatRoom: { id: "1" } // Static testing room
      };

      this.chatService.sendMessage('1', messagePayload);
      this.messageText = ''; // Input khali kar do
    }
  }
}