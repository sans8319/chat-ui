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
  @Input() roomId: string | null = null; 
  messageText: string = '';

  constructor(private chatService: ChatService) {}

  sendMessage() {
    if (this.messageText.trim() && this.roomId) {
      const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      
      // 1-on-1 aur Groups dono ke liye compatible payload
      const messagePayload: any = {
        content: this.messageText,
        sender: { id: Number(currentUserId) },
        roomId: this.roomId // Backend isko direct read karega
      };

      // --- PURANI FUNCTIONALITY SAFE RAKHNE KE LIYE ---
      // Agar ye 1-on-1 chat hai (yani GROUP_ se shuru nahi ho raha)
      if (!this.roomId.startsWith('GROUP_')) {
        messagePayload.chatRoom = { id: Number(this.roomId) };
      }

      this.chatService.sendMessage(this.roomId, messagePayload);
      this.messageText = ''; 
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Agar Shift + Enter dabaya hai, toh browser ko apna kaam karne do (Nayi line banayega)
        return;
      } else {
        // Agar sirf Enter dabaya hai, toh nayi line banne se roko aur message send kar do
        event.preventDefault();
        this.sendMessage();
      }
    }
  }
}