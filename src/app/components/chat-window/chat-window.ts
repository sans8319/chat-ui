import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { ChatInputComponent } from '../chat-input/chat-input';
import { SidebarComponent } from '../sidebar/sidebar';
import { ChatService } from '../../services/chat';
import { Subscription } from 'rxjs'; 
import { NavRailComponent } from '../nav-rail/nav-rail';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { COUNTRY_CODES } from '../../utils/countries';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatInputComponent, SidebarComponent, NavRailComponent], 
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  messages: any[] = [];
  currentUserId: number | null = null;
  selectedUser: any = null; 
  currentRoomId: string | null = null; 
  isUserAtBottom = true; 
  newMessagesCount = 0;   
  private roomSubscription: Subscription | null = null; 

  currentTab: 'chats' | 'groups' | 'profile' = 'chats';
  profileData = {
    name: '',
    department: '',
    about: '',
    location: '',
    email: '',
    phone: '',
    designation: '',
    profilePicture: '',
    statusState: 'Online', // NAYA
    customStatusText: '' ,  // NAYA
    customStatusColor: '#22c55e',
    countryCode: '+91'

  };

  allCountryCodes = COUNTRY_CODES;
  isCountryDropdownOpen = false;
  countrySearchQuery = '';
  get filteredCountries() {
    if (!this.countrySearchQuery.trim()) return this.allCountryCodes;
    return this.allCountryCodes.filter(c => 
      c.name.toLowerCase().includes(this.countrySearchQuery.toLowerCase()) ||
      c.code.includes(this.countrySearchQuery)
    );
  }
  
  customColors = ['#14b8a6', '#f43f5e', '#6366f1', '#f97316', '#06b6d4', '#84cc16'];
  selectedStatusColor: string = '#22c55e'; // Draft state
  activeSetting: string = 'profile'; 
  selectedStatus: string = 'Online';
  customStatusText: string = '';

  

  statusOptions = [
    { name: 'Online', desc: 'Available and ready to chat', color: '#22c55e', isInitial: true },
    { name: 'Away', desc: 'Away from keyboard', color: '#f59e0b', icon: 'bi-clock-fill' },
    { name: 'In a meeting', desc: 'Currently in a meeting', color: '#3b82f6', icon: 'bi-cup-hot-fill' },
    { name: 'On a call', desc: 'Busy on a call', color: '#8b5cf6', icon: 'bi-telephone-fill' },
    { name: 'Do not disturb', desc: 'Not available right now', color: '#ef4444', icon: 'bi-slash-circle-fill' },
    { name: 'Offline', desc: 'Not available', color: '#94a3b8', icon: 'bi-three-dots' }
  ];

  get currentStatusObj() {
    return this.statusOptions.find(s => s.name === this.selectedStatus) || this.statusOptions[0];
  }
  get savedStatusObj() {
    return this.statusOptions.find(s => s.name === this.profileData.statusState) || this.statusOptions[0];
  }
  
  onStatusChange(opt: any) {
    this.selectedStatusColor = opt.color;
    this.customStatusText = ''; // Custom text ko forcefully clear karega
  }

  // NAYA: Dropdown Functions
  toggleCountryDropdown() {
    this.isCountryDropdownOpen = !this.isCountryDropdownOpen;
    if (this.isCountryDropdownOpen) this.countrySearchQuery = ''; 
  }

  selectCountry(country: any) {
    this.profileData.countryCode = country.code;
    this.isCountryDropdownOpen = false;
  }

  allowOnlyNumbers(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault(); 
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-container')) {
      this.isCountryDropdownOpen = false;
    }
  }

  onPhoneInput(value: string) {
    let cleaned = value.replace(/\D/g, ''); // Sirf number allow karega
    if (cleaned.length > 10) cleaned = cleaned.substring(0, 10);
    
    let formatted = cleaned;
    if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    } else if (cleaned.length > 3) {
      formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
    
    this.profileData.phone = formatted;
  }

  // NAYA: Jab user custom type karna shuru kare toh radio button hata do
  onCustomTextType() {
    if (this.customStatusText.trim().length > 0) {
      this.selectedStatus = ''; // Radio button deselect
    } else {
      // Agar user text mita de, toh wapas DB wala ya default select kar do
      this.selectedStatus = this.profileData.statusState || 'Online';
      this.selectedStatusColor = this.profileData.customStatusColor || '#22c55e';
    }
  }

async saveStatus() {
      if (!this.currentUserId) return;
      
      const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
      const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

      // Draft ko profileData mein set karein
      this.profileData.statusState = this.selectedStatus;
      this.profileData.customStatusText = this.customStatusText;
      this.profileData.customStatusColor = this.selectedStatusColor;

      let finalImageUrl = (this.profileData as any).profilePicture || '';
      const payload = { ...this.profileData, profilePicture: finalImageUrl };

      this.http.put(`http://localhost:8080/api/users/${this.currentUserId}/profile`, payload, { headers })
        .subscribe({
          next: (response: any) => {
            alert("Status updated successfully! ✅");
            if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('statusColor', this.selectedStatusColor);
          }
            this.chatService.notifyProfileUpdate(response); // Sidebar update hogi
            this.cdr.detectChanges();
          },
          error: (err) => alert("Failed to save status.")
        });
    }

  selectedAvatarBg: string = '';
  selectedAvatarIcon: string = '';
  selectedAvatarImage: string | null = null; 
  selectedFile: File | null = null;

  constructor(
    private chatService: ChatService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  @HostListener('window:focus')
  onWindowFocus() {
    if (this.selectedUser) {
      this.markMessagesAsSeen();
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserId = Number(localStorage.getItem('userId'));
      this.fetchUserProfile();
    }

    this.chatService.activeTab$.subscribe(tab => {
      this.currentTab = tab;
      if (tab === 'profile') {
        this.fetchUserProfile();
      }
      this.cdr.detectChanges();
    });

    this.chatService.activeSetting$.subscribe(setting => {
      this.activeSetting = setting;
      
      // NAYA: Jab bhi Status tab khule, radio button aur text ko saved DB data par Reset/Lock kardo
      if (setting === 'status') {
        this.selectedStatus = this.profileData.statusState || 'Online';
        this.customStatusText = this.profileData.customStatusText || '';
        this.selectedStatusColor = this.profileData.customStatusColor || '#22c55e';
      }
      
      this.cdr.detectChanges();
    });

    this.chatService.selectedUser$.subscribe(selection => {
      if (selection) {
        this.selectedUser = selection;
        this.messages = []; 
        
        if (this.currentUserId && !selection.isGroup) {
          this.loadRoomAndHistory(this.currentUserId, selection.id);
        } else if (selection.isGroup) {
          this.currentRoomId = selection.id; 
          this.chatService.subscribeToRoom(this.currentRoomId!); 

          this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
            this.messages = history.map(msg => {
              if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true; 
                msg.content = Number(msg.senderId) === Number(this.currentUserId) 
                    ? "You created this group." : "You were added to this group.";
              }
              if (Array.isArray(msg.timestamp)) {
                 msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
              }
              return msg;
            });
            setTimeout(() => this.scrollToBottom(), 100);
            this.listenToMessages(); 
            this.cdr.detectChanges();
          });
        }
      } else {
        this.selectedUser = null;
      }
      this.cdr.detectChanges();
    });
  }

  fetchUserProfile() {
    if (!this.currentUserId) return;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(`http://localhost:8080/api/users/${this.currentUserId}`, { headers })
      .subscribe(user => {
        if (user) {
          this.profileData = {
            name: user.username || '',
            department: user.department || '',
            about: user.about || '',
            location: user.location || '',
            email: user.email || '',
            phone: user.phone || '',
            designation: user.designation || '',
            profilePicture: user.profilePicture || '',
            statusState: user.statusState || 'Online', // NAYA
            customStatusText: user.customStatusText || '' ,// NAYA
            customStatusColor: user.customStatusColor || '#22c55e' , // NAYA
            countryCode: user.countryCode || '+91' // NAYA

          };
          
          this.profileData.customStatusColor = user.customStatusColor || '#22c55e';
          this.selectedStatusColor = this.profileData.customStatusColor;
          this.selectedStatus = this.profileData.statusState;
          this.customStatusText = this.profileData.customStatusText;
          if (user.profilePicture) {
            (this.profileData as any).profilePicture = user.profilePicture;
            this.updateLocalPreview(user.profilePicture);
          }
        }
      });
  }

  updateLocalPreview(path: string) {
    const parsed = this.parseProfilePicture(path);
    if (parsed.isImage) {
      this.selectedAvatarImage = parsed.url!;
      this.selectedAvatarBg = '';
      this.selectedAvatarIcon = '';
    } else if (parsed.isAvatar) {
      this.selectedAvatarBg = parsed.bg!;
      this.selectedAvatarIcon = parsed.icon!;
      this.selectedAvatarImage = null;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.selectedAvatarBg = ''; 
      this.selectedAvatarIcon = '';
      const reader = new FileReader();
      reader.onload = () => this.selectedAvatarImage = reader.result as string; 
      reader.readAsDataURL(file);
    }
  }

  selectPredefinedAvatar(bg: string, icon: string) {
    this.selectedAvatarBg = bg;
    this.selectedAvatarIcon = icon;
    this.selectedAvatarImage = null;
    this.selectedFile = null;
  }

  async saveProfile() {
    if (!this.currentUserId) return;
    const rawPhone = this.profileData.phone ? this.profileData.phone.replace(/\D/g, '') : '';
    if (rawPhone.length > 0 && rawPhone.length !== 10) {
      alert("⚠️ Phone number must be exactly 10 digits!");
      return; 
    }
    
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    let finalImageUrl = (this.profileData as any).profilePicture || '';

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      try {
        const uploadRes: any = await this.http.post('http://localhost:8080/api/files/upload', formData, { headers }).toPromise();
        finalImageUrl = uploadRes.url; 
      } catch (err) {
        alert("Failed to upload image.");
        return; 
      }
    } 
    else if (this.selectedAvatarBg && this.selectedAvatarIcon) {
      finalImageUrl = `${this.selectedAvatarBg}|${this.selectedAvatarIcon}`;
    }

    const payload = { 
      ...this.profileData, 
      profilePicture: finalImageUrl 
    };

    this.http.put(`http://localhost:8080/api/users/${this.currentUserId}/profile`, payload, { headers })
      .subscribe({
        next: (response: any) => {
          alert("Profile updated successfully! ✅");
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('username', this.profileData.name);
            if (finalImageUrl) localStorage.setItem('profilePicture', finalImageUrl);
            (this.profileData as any).profilePicture = finalImageUrl;
          }
          // --- NAYA: Services ko notify karein ---
          this.chatService.notifyProfileUpdate(response);
          this.cdr.detectChanges();
        },
        error: (err) => alert("Failed to save profile.")
      });
  }

  loadRoomAndHistory(user1Id: number, user2Id: number) {
    this.chatService.getOrCreateRoom(user1Id, user2Id).subscribe(room => {
      if (room && room.id) {
        this.currentRoomId = room.id.toString();
        if (this.roomSubscription) this.roomSubscription.unsubscribe();

        this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
          this.messages = history.map(msg => {
            if (msg.senderName === 'System' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true;
                msg.content = Number(msg.senderId) === Number(this.currentUserId) ? "You created this chat." : msg.content;
            }
            if (Array.isArray(msg.timestamp)) {
               msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
            }
            return msg;
          });
          this.markMessagesAsSeen();
          setTimeout(() => this.scrollToBottom(), 100);
          this.cdr.detectChanges();
        });

        this.chatService.subscribeToRoom(this.currentRoomId!);
        this.listenToMessages(); 
      }
    });
  }

  listenToMessages() {
    if (this.roomSubscription) this.roomSubscription.unsubscribe();
    this.roomSubscription = this.chatService.getMessages().subscribe(msg => {
      if (msg && String(msg.roomId) === String(this.currentRoomId)) {
        if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
            msg.isSystem = true; 
            msg.content = Number(msg.senderId) === Number(this.currentUserId) ? "You created this group." : "You were added to this group.";
        }
        if (Array.isArray(msg.timestamp)) {
           msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
        }
        this.ngZone.run(() => {
          const exists = this.messages.some(m => m.id === msg.id);
          if (!exists) {
            this.messages.push(msg);
            if (msg.senderId !== this.currentUserId && !this.selectedUser?.isGroup) {
              if (document.hasFocus()) {
                this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'SEEN');
                msg.seen = true;
              } else {
                this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'DELIVERED');
              }
            }
            if (this.isUserAtBottom || msg.senderId === this.currentUserId) {
              setTimeout(() => this.scrollToBottom(), 50);
            } else {
              this.newMessagesCount++;
            }
            this.cdr.detectChanges();
          }
        });
      }
    });

    this.chatService.getReceipts().subscribe(receipt => {
      if (receipt && String(receipt.roomId) === String(this.currentRoomId)) {
        const msgIndex = this.messages.findIndex(m => m.id === receipt.messageId);
        if (msgIndex !== -1) {
          if (receipt.status === 'DELIVERED') this.messages[msgIndex].delivered = true;
          else if (receipt.status === 'SEEN') {
            this.messages[msgIndex].delivered = true;
            this.messages[msgIndex].seen = true;
          }
          this.cdr.detectChanges();
        }
      }
    });
  }

  markMessagesAsSeen() {
    if (!this.currentRoomId || !this.currentUserId || this.selectedUser?.isGroup) return; 
    let needsUpdate = false;
    this.messages.forEach(msg => {
      if (msg.senderId !== this.currentUserId && !msg.seen) {
        this.chatService.sendReceipt(this.currentRoomId!, msg.id, 'SEEN');
        msg.seen = true;
        msg.delivered = true;
        needsUpdate = true;
      }
    });
    if (needsUpdate) this.cdr.detectChanges();
  }

  ngOnDestroy() {
    if (this.roomSubscription) this.roomSubscription.unsubscribe();
  }

  onScroll(event: any) {
    const element = event.target;
    this.isUserAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    if (this.isUserAtBottom) this.newMessagesCount = 0;
  }

  scrollToBottom() {
    try {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
        this.isUserAtBottom = true;
        this.newMessagesCount = 0;
      }
    } catch(err) {}
  }

  parseProfilePicture(path: string) {
    if (!path) return { isImage: false, isAvatar: false };
    if (path.startsWith('/uploads/')) return { isImage: true, url: `http://localhost:8080${path}` };
    if (path.includes('|')) {
      const parts = path.split('|');
      return { isImage: false, isAvatar: true, bg: parts[0], icon: parts[1] };
    }
    return { isImage: false, isAvatar: false };
  }
}