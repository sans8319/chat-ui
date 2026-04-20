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
    this.stompClient?.subscribe(`/topic/room/${roomId}`, (message: Message) => {
      if (message.body) {
        this.messageSubject.next(JSON.parse(message.body));
      }
    });
  }

  sendMessage(roomId: string, messageContent: any) {
  console.log('Sending message...', this.stompClient?.connected); // Ye check karega
  if (this.stompClient && this.stompClient.connected) {
    this.stompClient.publish({
      destination: '/app/chat.sendMessage',
      body: JSON.stringify(messageContent)
    });
  } else {
    console.error('STOMP client not connected!');
  }
}

  getMessages(): Observable<any> {
    return this.messageSubject.asObservable();
  }
}