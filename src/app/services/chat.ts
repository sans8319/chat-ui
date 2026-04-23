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
  private pendingRooms = new Set<string>(); 

  // --- NAYA: Background Notifications (New User/Group ke liye) ---
  private notificationSource = new BehaviorSubject<any>(null);
  notificationUpdate$ = this.notificationSource.asObservable();

  // --- NAYA LOGIC: Tab Switching (Chats vs Groups) ---
  private activeTabSource = new BehaviorSubject<'chats' | 'groups'>('chats');
  activeTab$ = this.activeTabSource.asObservable();

  setActiveTab(tab: 'chats' | 'groups') {
    this.activeTabSource.next(tab);
    this.selectedUserSource.next(null);
  }

  selectUser(user: any) {
    this.selectedUserSource.next(user);
  }

  constructor(private http: HttpClient) { 
    this.initConnection();
  }

  // --- PRODUCTION GRADE CONNECTION LOGIC ---
  private initConnection() {
    const socket = new SockJS('http://localhost:8080/ws-chat');
    this.stompClient = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000, 
      heartbeatOutgoing: 10000,
    });

    this.stompClient.onConnect = (frame) => {
      console.log('✅ Connected to WebSocket');

      const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

      // --- NAYA: Background Alert Subscriptions ---
      
      // 1. PERSONAL ALERTS: Jab koi aapko naye group mein add kare
      if (currentUserId) {
        this.stompClient?.subscribe(`/topic/user/${currentUserId}`, (msg) => {
          if (msg.body) {
            this.notificationSource.next(JSON.parse(msg.body));
          }
        });
      }

      // 2. PUBLIC ALERTS: Jab koi naya user register ho
      this.stompClient?.subscribe(`/topic/public/updates`, (msg) => {
        if (msg.body) {
          this.notificationSource.next(JSON.parse(msg.body));
        }
      });

      // 3. Purana pending rooms logic (DM/Group chats)
      this.pendingRooms.forEach(roomId => {
        if (!this.activeRooms.has(roomId)) {
          this.activeRooms.add(roomId);
          this.performStompSubscription(roomId);
        }
      });
      this.pendingRooms.clear();
    };

    this.stompClient.onStompError = (frame) => {
      console.error('❌ Broker reported error: ' + frame.headers['message']);
      console.error('❌ Additional details: ' + frame.body);
    };

    this.stompClient.activate();
  }

  // --- SAFE SUBSCRIPTION LOGIC ---
  subscribeToRoom(roomId: string) {
    if (this.activeRooms.has(roomId)) return;
    
    if (this.stompClient && this.stompClient.connected) {
      this.activeRooms.add(roomId);
      this.performStompSubscription(roomId);
    } else {
      this.pendingRooms.add(roomId);
    }
  }

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
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(messageContent)
      });
    } else {
      console.warn("⚠️ WebSocket is disconnected. Message not sent.");
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
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get(`http://localhost:8080/api/rooms/dm?user1=${user1Id}&user2=${user2Id}`, { headers });
  }

  getChatHistory(roomId: string): Observable<any[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get<any[]>(`http://localhost:8080/api/messages/${roomId}`, { headers });
  }

  disconnect() {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.deactivate();
      this.activeRooms.clear();
      this.pendingRooms.clear();
      console.log('🛑 Disconnected from WebSocket');
    }
  }
}