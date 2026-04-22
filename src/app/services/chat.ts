import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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

 constructor(private http: HttpClient) { // HttpClient inject karein
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
  getOrCreateRoom(user1Id: number, user2Id: number): Observable<any> {
    // 1. LocalStorage se token nikalein
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    
    // 2. Token ko Authorization header mein daalein
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // 3. Request ke saath headers bhi bhejein
    return this.http.get(`http://localhost:8080/api/rooms/dm?user1=${user1Id}&user2=${user2Id}`, { headers });
  }

  // --- NAYA LOGIC: Chat History Load Karne Ke Liye ---
  getChatHistory(roomId: string): Observable<any[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any[]>(`http://localhost:8080/api/messages/${roomId}`, { headers });
  }

}