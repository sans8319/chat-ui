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

  // --- NAYA LOGIC: Sidebar Update Trigger ---
  private sidebarUpdateSource = new BehaviorSubject<any>(null);
  sidebarUpdate$ = this.sidebarUpdateSource.asObservable();

  // NAYA: Duplicate subscriptions rokne ke liye ek Tracker (Set)
  private activeRooms = new Set<string>();

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
      // Note: Room subscription ab dynamic handle hota hai chat-window se
    };

    this.stompClient.activate();
  }

  subscribeToRoom(roomId: string) {
    // --- MASTER FIX FOR MULTIPLE COUNTS (1 -> 2 -> 4 BUG) ---
    // Agar is room ka subscription pehle se active hai, toh wapas subscribe mat karo!
    if (this.activeRooms.has(roomId)) {
      return; 
    }
    
    // Room ko 'Set' mein daal do taaki system ko yaad rahe
    this.activeRooms.add(roomId);

    // 1. Regular messages sunne ke liye
    this.stompClient?.subscribe(`/topic/room/${roomId}`, (message: Message) => {
      if (message.body) {
        const parsedMsg = JSON.parse(message.body);
        
        // --- NAYA LOGIC: Sidebar ko batayein ki naya message aaya hai ---
        this.sidebarUpdateSource.next(parsedMsg);
        
        this.messageSubject.next(parsedMsg);
      }
    });

    // 2. Ticks (Receipts) sunne ke liye
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
}