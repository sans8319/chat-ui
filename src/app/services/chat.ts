import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private stompClient: Client | null = null;
  private messageSubject = new BehaviorSubject<any>(null);
  private receiptSubject = new BehaviorSubject<any>(null); // Receipts ke liye
  
  private selectedUserSource = new BehaviorSubject<any>(null); 
  selectedUser$ = this.selectedUserSource.asObservable();     

  selectUser(user: any) {
    this.selectedUserSource.next(user);
  }

  constructor() {
    this.initConnection();
  }

  private initConnection() {
    const socket = new SockJS('http://localhost:8080/ws-chat');
    this.stompClient = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.stompClient.onConnect = (frame) => {
      console.log('Connected to WebSocket');
      // Room ID abhi static rakhte hain testing ke liye
      this.subscribeToRoom('1');
    };

    this.stompClient.activate();
  }

  subscribeToRoom(roomId: string) {
    // 1. Regular messages sunne ke liye
    this.stompClient?.subscribe(`/topic/room/${roomId}`, (message: Message) => {
      if (message.body) {
        this.messageSubject.next(JSON.parse(message.body));
      }
    });

    // 2. NAYA LOGIC: Ticks (Receipts) sunne ke liye
    this.stompClient?.subscribe(`/topic/room/${roomId}/receipts`, (message: Message) => {
      if (message.body) {
        this.receiptSubject.next(JSON.parse(message.body));
      }
    });
  }

  sendMessage(roomId: string, messageContent: any) {
    console.log('Sending message...', this.stompClient?.connected); 
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(messageContent)
      });
    } else {
      console.error('STOMP client not connected!');
    }
  }

  // --- NAYA LOGIC: Ticks ka data UI ko dene ke liye ---
  getReceipts(): Observable<any> {
    return this.receiptSubject.asObservable();
  }

  // --- NAYA LOGIC: Backend ko batane ke liye ki message pahunch gaya ---
  sendReceipt(roomId: string, messageId: number, status: string) {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: '/app/chat.receipt',
        body: JSON.stringify({ messageId, status, roomId })
      });
    }
  }

  getMessages(): Observable<any> {
    return this.messageSubject.asObservable();
  }
}