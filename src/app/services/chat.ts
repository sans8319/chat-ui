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
  private receiptSubject = new BehaviorSubject<any>(null); 
  
  private selectedUserSource = new BehaviorSubject<any>(null); 
  selectedUser$ = this.selectedUserSource.asObservable();     

  private sidebarUpdateSource = new BehaviorSubject<any>(null);
  sidebarUpdate$ = this.sidebarUpdateSource.asObservable();

  private activeRooms = new Set<string>();
  // --- NAYA LOGIC: Jo rooms connect hone se pehle aayenge, unhe yahan safe rakhenge ---
  private pendingRooms = new Set<string>(); 

  selectUser(user: any) {
    this.selectedUserSource.next(user);
  }

  constructor(private http: HttpClient) { 
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
      
      // --- NAYA LOGIC: Jaise hi connect ho, pending rooms ko subscribe kar do ---
      this.pendingRooms.forEach(roomId => {
        if (!this.activeRooms.has(roomId)) {
          this.activeRooms.add(roomId);
          this.performStompSubscription(roomId);
        }
      });
      this.pendingRooms.clear(); // Line clear kar do
    };

    this.stompClient.activate();
  }

  subscribeToRoom(roomId: string) {
    if (this.activeRooms.has(roomId)) {
      return; 
    }

    // Agar connected hai toh turant subscribe karo
    if (this.stompClient && this.stompClient.connected) {
      this.activeRooms.add(roomId);
      this.performStompSubscription(roomId);
    } else {
      // Agar connected nahi hai, toh fail hone ki jagah pending queue mein daal do
      this.pendingRooms.add(roomId);
    }
  }

  // Asli subscription logic ko alag function mein daal diya taaki clean rahe
  private performStompSubscription(roomId: string) {
    this.stompClient?.subscribe(`/topic/room/${roomId}`, (message: Message) => {
      if (message.body) {
        const parsedMsg = JSON.parse(message.body);
        this.sidebarUpdateSource.next(parsedMsg);
        this.messageSubject.next(parsedMsg);
      }
    });

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

  getReceipts(): Observable<any> {
    return this.receiptSubject.asObservable();
  }

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`http://localhost:8080/api/rooms/dm?user1=${user1Id}&user2=${user2Id}`, { headers });
  }

  getChatHistory(roomId: string): Observable<any[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<any[]>(`http://localhost:8080/api/messages/${roomId}`, { headers });
  }

  isSubscribed(roomId: string): boolean {
    return this.activeRooms.has(roomId) || this.pendingRooms.has(roomId);
  }
}