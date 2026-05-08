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
import { LinkifyPipe } from '../../pipes/linkify-pipe';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatInputComponent, SidebarComponent, NavRailComponent, LinkifyPipe], 
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  readonly String = String;
  messages: any[] = [];
  currentUserId: number | null = null;
  selectedUser: any = null; 
  currentRoomId: string | null = null; 
  isUserAtBottom = true; 
  newMessagesCount = 0;   
  private roomSubscription: Subscription | null = null; 
  selectedMediaForPreview: { url: string, type: string, name: string } | null = null;

  lastClearedMessageId: { [roomId: string]: number } = {};

  isGroupSettingsExpanded: boolean = false;
  selectedGroupPermission: string = 'Everyone';
  isApplyingSettings: boolean = false;

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
    countryCode: '+91',
    pinnedRooms: '',

  };

  allCountryCodes = COUNTRY_CODES;
  isCountryDropdownOpen = false;
  countrySearchQuery = '';
  contextMenu = { show: false, x: 0, y: 0, member: null as any, isRemoving: false };

  activeMessageDropdown: number | null = null;

  showProfilePanel: boolean = false;
  
  // Naye variables tabs ke liye
  activePanelState: 'main' | 'media' = 'main'; 
  activeMediaTab: 'media' | 'links' | 'docs' = 'media';


  showForwardModal: boolean = false;
  forwardSearchQuery: string = '';
  allContactsForForward: any[] = [];
  selectedContactsForForward: any[] = [];
  msgToForward: any = null;
  isForwarding: boolean = false;

  roomMediaFiles: any[] = [];
  roomLinks: any[] = [];
  roomDocs: any[] = [];
  groupMembers: any[] = []; 

  isChatSearchActive: boolean = false;
  chatSearchQuery: string = '';
  searchMatches: number[] = [];
  currentMatchIndex: number = -1;
  hasSearched: boolean = false;

  isPinnedExpanded: boolean = false;
  currentPinnedIndex: number = 0;

  showDeleteGroupModal: boolean = false;
  isDeletingGroup: boolean = false;

  toggleProfilePanel() {
    this.showProfilePanel = !this.showProfilePanel;
    if (!this.showProfilePanel) {
      this.activePanelState = 'main';
    } else if (this.selectedUser?.isGroup) {
      // 🛑 NAYA FIX: .toLowerCase() lagane se ab kabhi chhote-bade letters ka mismatch nahi hoga
      this.selectedGroupPermission = (this.selectedUser.permissions || '').toLowerCase() === 'admins' ? 'admins' : 'everyone';
      const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));
      
      this.chatService.getGroupMembers(groupId).subscribe(members => {
        // NAYA LOGIC: Sorting taaki 'You' sabse aakhir mein aaye
        members.sort((a, b) => {
          if (a.id === this.currentUserId) return 1; // Current user ko neeche bhejo
          if (b.id === this.currentUserId) return -1; // Dusre ko upar rakho
          return a.username.localeCompare(b.username); // Baaki sabko Alphabetically arrange kar do (Bonus feature!)
        });
        
        this.groupMembers = members;
        this.cdr.detectChanges();
      });
    }
  }

  closeProfilePanel() {
    this.showProfilePanel = false;
    setTimeout(() => this.activePanelState = 'main', 300); // Animation ke baad reset ho taaki agli baar main page khule
  }

  // Naya function tab kholne aur data fetch karne ke liye
  openMediaPanel(tab: 'media' | 'links' | 'docs') {
    this.activePanelState = 'media';
    this.activeMediaTab = tab;
    if (this.currentRoomId) {
       this.fetchRoomMedia(this.currentRoomId);
    }
  }

  backToMainPanel() {
    this.activePanelState = 'main';
  }


  get isCurrentChatPinned(): boolean {
    const pinnedStr = (this.profileData as any).pinnedRooms || (typeof window !== 'undefined' ? localStorage.getItem('pinnedRooms') : '') || '';
    const actualId = String(this.selectedUser?.id || '').replace('GROUP_', '');
const roomId = this.selectedUser?.isGroup ? `GROUP_${actualId}` : this.currentRoomId;
    return pinnedStr.includes(`,${roomId},`);
  }


  get isCurrentUserAdmin(): boolean {
    if (!this.selectedUser?.isGroup || !this.groupMembers || !this.currentUserId) return false;
    
    
    const currentUserMember = this.groupMembers.find(m => m.id === this.currentUserId);
    
    
    return currentUserMember?.isAdmin || false;
  }

  togglePin() {
    if (!this.currentUserId || !this.currentRoomId) return;
    const actualId = String(this.selectedUser?.id || '').replace('GROUP_', '');
    const roomId = this.selectedUser?.isGroup ? `GROUP_${actualId}` : this.currentRoomId;
    
    this.chatService.togglePin(this.currentUserId, roomId).subscribe((res: any) => {
      (this.profileData as any).pinnedRooms = res.pinnedRooms;
      if (typeof window !== 'undefined') localStorage.setItem('pinnedRooms', res.pinnedRooms);
      
      // Sidebar ko notify karo taaki wo chats ko upar-neeche sort kar sake
      this.chatService.notifyProfileUpdate({ type: 'PIN_UPDATED' });
      this.cdr.detectChanges();
    });
  }


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
  isChangingPassword = false;
  passwordData = { current: '', new: '', confirm: '' };
  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;
  showDeleteAccountModal = false;
  isCurrentPwdInvalid = false; // Current password galat hai ya nahi
  isCheckingPwd = false;       // API call ho rahi hai ya nahi

  showAddMemberModal = false;
  addMemberSearchQuery = '';
  allAppUsers: any[] = [];
  selectedUsersToAdd: any[] = [];
  isAddingMembers = false;
  
  selectedAvatarBg: string = '';
  selectedAvatarIcon: string = '';
  selectedAvatarImage: string | null = null; 
  selectedFile: File | null = null;

  showClearChatModal = false;
  isClearingChat = false;

  openClearChatModal() {
    this.showClearChatModal = true;
  }

  closeClearChatModal() {
    this.showClearChatModal = false;
  }

  confirmClearChat() {
    if (!this.currentRoomId) return;
    
    this.isClearingChat = true;

    if (this.messages.length > 0) {
      const maxId = Math.max(...this.messages.map(m => m.id));
      this.lastClearedMessageId[this.currentRoomId] = maxId;
    }
    
    // API call karke messages clear karenge
    this.chatService.clearChatHistory(this.currentRoomId).subscribe({
      next: () => {
        this.messages = []; // 1. Screen se saare messages hata do
        this.roomMediaFiles = []; // 2. Media panel se bhi hata do
        this.roomLinks = [];
        this.roomDocs = [];
        
        // 🛑 NAYA FIX: Sidebar ko turant batao ki is room ki chat clear ho chuki hai
        this.chatService.notifyProfileUpdate({ type: 'CHAT_CLEARED', roomId: this.currentRoomId });

        this.showClearChatModal = false; // 3. Modal band karo
        this.isClearingChat = false;
        this.closeProfilePanel(); // 4. Right panel bhi band kardo
      },
      error: (err) => {
        alert("Failed to clear chat.");
        this.isClearingChat = false;
      }
    });
  }


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

    this.closeContextMenu();
    if (!target.closest('.msg-dropdown-container')) {
      this.activeMessageDropdown = null;
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
      this.isChangingPassword = false; 
      
      // NAYA: Jab bhi Status tab khule, radio button aur text ko saved DB data par Reset/Lock kardo
      if (setting === 'status') {
        this.selectedStatus = this.profileData.statusState || 'Online';
        this.customStatusText = this.profileData.customStatusText || '';
        this.selectedStatusColor = this.profileData.customStatusColor || '#22c55e';
      }
      
      this.cdr.detectChanges();
    });
    // NAYA: Jab koi dusra user status badle, toh header ko turant refresh karo
    this.chatService.notificationUpdate$.subscribe(notif => {
      if (notif && notif.type === 'PROFILE_UPDATED') {
        // Agar hum kisi se chat kar rahe hain aur wo group nahi hai, toh uska data re-fetch karo
        if (this.selectedUser && !this.selectedUser.isGroup) {
          this.refreshHeaderData();
        }
      }
    });

    this.chatService.selectedUser$.subscribe(selection => {
      if (selection) {

        this.closeProfilePanel();
        this.selectedUser = selection;
        this.messages = []; 
        this.isPinnedExpanded = false; 
        this.currentPinnedIndex = 0;
        
        if (this.currentUserId && !selection.isGroup) {
          this.loadRoomAndHistory(this.currentUserId, selection.id);
        } else if (selection.isGroup) {
          this.currentRoomId = selection.id; 
          this.chatService.subscribeToRoom(this.currentRoomId!); 

          // 🛑 MAGIC FIX: 'GROUP_12' ki jagah asli '12' ID bhejo API call me
          const actualGroupId = Number(String(selection.id).replace('GROUP_', ''));
          
          this.chatService.getGroupMembers(actualGroupId).subscribe(members => {
            // Thoda premium touch: 'You' ko list mein sabse neeche sort kar do
            members.sort((a, b) => {
              if (a.id === this.currentUserId) return 1;
              if (b.id === this.currentUserId) return -1;
              return a.username.localeCompare(b.username);
            });
            this.groupMembers = members;
            this.cdr.detectChanges();
          });

          this.chatService.getChatHistory(this.currentRoomId!).subscribe(history => {
            this.messages = history.map(msg => {
              // ... aapka system message logic ...
              if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true; 
                msg.content = Number(msg.senderId) === Number(this.currentUserId) 
                    ? "You created this group." : "You were added to this group.";
              }
              if (Array.isArray(msg.timestamp)) {
                 msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
              }
              // =====================================
              // NAYA: Media fields directly pass hone chahiye group messages mein
              // =====================================
              return {
                 ...msg,
                 isPinned: msg.isPinned === true || msg.pinned === true || false,   // 🛑 MAGIC FIX: JSON naam ki problem solve
                 isDeleted: msg.isDeleted === true || msg.deleted === true || false, // Deleted ko bhi safe kiya
                 fileUrl: msg.fileUrl || null,
                 fileName: msg.fileName || null,
                 fileType: msg.fileType || null,
                 fileSize: msg.fileSize || null
              };
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

    // NAYA: Jab bhi input component signal bheje, toh profile panel band kar do
    this.chatService.closeProfilePanel$.subscribe(() => {
      if (this.showProfilePanel) {
        this.showProfilePanel = false;
        // Agar media preview wala state open tha, toh usko bhi reset kar do
        this.activePanelState = 'main'; 
        this.cdr.detectChanges();
      }
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
            countryCode: user.countryCode || '+91' ,
            pinnedRooms: user.pinnedRooms || ''

          };

          if (isPlatformBrowser(this.platformId)) {
             localStorage.setItem('pinnedRooms', user.pinnedRooms || '');
          }
          
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

   refreshHeaderData() {
    if (!this.selectedUser || this.selectedUser.isGroup) return;

    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(`http://localhost:8080/api/users/${this.selectedUser.id}`, { headers })
      .subscribe(updatedUser => {
        if (updatedUser) {
          // Sirf status aur identity fields update karenge taaki chat break na ho
          this.selectedUser.online = updatedUser.online;
          this.selectedUser.customStatusColor = updatedUser.customStatusColor;
          this.selectedUser.customStatusText = updatedUser.customStatusText;
          this.selectedUser.statusState = updatedUser.statusState;
          this.cdr.detectChanges();
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

  // =====================================
  // CHANGE PASSWORD LOGIC
  // =====================================

   openChangePassword() {
    this.isChangingPassword = true;
    this.passwordData = { current: '', new: '', confirm: '' };
    this.showCurrentPwd = false; this.showNewPwd = false; this.showConfirmPwd = false;
  }

  closeChangePassword() {
    this.isChangingPassword = false;
  }



  togglePwd(field: string) {
    if (field === 'current') this.showCurrentPwd = !this.showCurrentPwd;
    if (field === 'new') this.showNewPwd = !this.showNewPwd;
    if (field === 'confirm') this.showConfirmPwd = !this.showConfirmPwd;
  }

  get pwdStrength() {
    const p = this.passwordData.new;
    if (!p) return 0;
    let strength = 0;
    if (p.length >= 8) strength++; // Min 8 chars
    if (/[A-Za-z]/.test(p) && /[0-9]/.test(p)) strength++; // Letters & numbers
    if (/[\W_]/.test(p)) strength++; // Symbols
    return strength; // Returns 0, 1 (Weak), 2 (Medium), 3 (Strong)
  }

   checkCurrentPassword() {
    if (!this.passwordData.current) return;
    
    this.isCheckingPwd = true;

    // NAYA: Token Headers add kiye
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    // NAYA: String ki jagah JSON Object bhej rahe hain
    const payload = { password: this.passwordData.current };

    this.http.post<boolean>(`http://localhost:8080/api/users/${this.currentUserId}/verify-password`, payload, { headers })
      .subscribe({
        next: (isValid) => {
          this.isCurrentPwdInvalid = !isValid; 
          this.isCheckingPwd = false;
        },
        error: (err) => {
          // NAYA: Agar API token ya kisi wajah se fail ho, toh UI mein red border aayega taaki aapko pata chale
          console.error("Verification API failed:", err);
          this.isCurrentPwdInvalid = true; 
          this.isCheckingPwd = false;
        }
      });
  }

  // 2. Real API Update call
  updatePassword() {
    const payload = {
      currentPassword: this.passwordData.current,
      newPassword: this.passwordData.new
    };

    // NAYA: Update request mein bhi Token Headers add kiye
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.put(`http://localhost:8080/api/users/${this.currentUserId}/change-password`, payload, { 
      headers: headers, 
      responseType: 'text' as 'json' 
    })
      .subscribe({
        next: () => {
          alert("✅ Password updated successfully!");
          this.closeChangePassword();
        },
        error: (err) => {
          console.error("Update failed:", err);
          alert("❌ Failed to update password. Please check your current password.");
        }
      });
  }


  openDeleteAccountModal() {
    this.showDeleteAccountModal = true;
  }

  closeDeleteAccountModal() {
    this.showDeleteAccountModal = false;
  }

  confirmDeleteAccount() {
    if (!this.currentUserId) return;
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.delete(`http://localhost:8080/api/users/${this.currentUserId}`, { 
      headers: headers, responseType: 'text' as 'json' 
    }).subscribe({
      next: () => {
        alert("Your account has been deleted successfully. 🗑️");
        this.chatService.disconnect();
        localStorage.clear();
        window.location.href = '/'; // Login page par bhej dein
      },
      error: (err) => alert("Failed to delete account.")
    });
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
            if (msg.senderName && msg.senderName.includes('_DELETED_')) {
              msg.senderName = msg.senderName.split('_DELETED_')[0];
            }
            
            if (msg.senderName === 'System' || msg.content === '###GROUP_CREATED###') {
                msg.isSystem = true;
                msg.content = Number(msg.senderId) === Number(this.currentUserId) ? "You created this chat." : msg.content;
            }
            if (Array.isArray(msg.timestamp)) {
               msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
            }
            return {
               ...msg,
               isPinned: msg.isPinned === true || msg.pinned === true || false,   
               isDeleted: msg.isDeleted === true || msg.deleted === true || false, 
               fileUrl: msg.fileUrl || null,
               fileName: msg.fileName || null,
               fileType: msg.fileType || null,
               fileSize: msg.fileSize || null
            };
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

        if (msg.type === 'ADMIN_PROMOTED' || msg.type === 'ADMIN_DISMISSED') {
           this.ngZone.run(() => {
             const member = this.groupMembers.find(m => m.id === Number(msg.userId));
             if (member) {
                
                member.isAdmin = (msg.type === 'ADMIN_PROMOTED'); 
             }
             this.cdr.detectChanges();
           });
           return; 
        }
        if (msg.type === 'MESSAGE_DELETED') {
           this.ngZone.run(() => {
             // 1. Chat bubble update karo
             const targetMsg = this.messages.find(m => m.id === Number(msg.messageId));
             if (targetMsg) {
                targetMsg.isDeleted = true;
                targetMsg.content = 'This message is deleted';
                targetMsg.fileUrl = null;
                targetMsg.fileName = null;
                targetMsg.isPinned = false;
             }

             if (this.pinnedMessages.length === 0) {
               this.isPinnedExpanded = false;
             }

             // 2. Right Profile Panel se turant files/links/docs gayab karo
             this.roomMediaFiles = this.roomMediaFiles.filter(f => f.id !== Number(msg.messageId));
             this.roomDocs = this.roomDocs.filter(f => f.id !== Number(msg.messageId));
             this.roomLinks = this.roomLinks.filter(l => l.id !== Number(msg.messageId));

             this.cdr.detectChanges();
           });
           return; 
        }

        if (msg.type === 'MESSAGE_PINNED') {
           this.ngZone.run(() => {
             const targetMsg = this.messages.find(m => m.id === Number(msg.messageId));
             if (targetMsg) targetMsg.isPinned = msg.isPinned;
             
             // Agar last pinned msg unpin hua hai toh box band kardo
             if (this.pinnedMessages.length === 0) this.isPinnedExpanded = false;
             this.cdr.detectChanges();
           });
           return; 
        }

        if (msg.type === 'GROUP_SETTINGS_UPDATED') {
           this.ngZone.run(() => {
             // 🛑 MAGIC FIX: originalId (12) ko use karo, 'GROUP_12' ko nahi
             const currentId = String(this.selectedUser?.id || '').replace('GROUP_', '');
              const incomingId = String(msg.groupId).replace('GROUP_', '');
              if (this.selectedUser && this.selectedUser.isGroup && currentId === incomingId) {
               this.selectedUser.permissions = msg.permissions;
               this.selectedGroupPermission = msg.permissions; // Dropdown live update hoga
               this.cdr.detectChanges(); 
             }
           });
           return; 
        }

        if (msg.type === 'MEMBER_REMOVED') {
           this.ngZone.run(() => {
             // Deleted user ko array se hata do
             this.groupMembers = this.groupMembers.filter(m => m.id !== Number(msg.userId));
             this.cdr.detectChanges(); // UI Update
           });
           return; 
        }

        if (msg.type === 'GROUP_DELETED') {
          this.ngZone.run(() => {
            // 🛑 MAGIC FIX: Same ID mismatch problem fixed
            const currentId = String(this.selectedUser?.id || '').replace('GROUP_', '');
            const incomingId = String(msg.groupId).replace('GROUP_', '');
            if (this.selectedUser && this.selectedUser.isGroup && currentId === incomingId) {
              this.selectedUser = null; // Chat window turant band
              this.currentRoomId = null;
              this.showProfilePanel = false;
            }
            
            this.chatService.triggerNotification({ type: 'GROUP_DELETED', groupId: msg.groupId });
            this.cdr.detectChanges();
          });
          return;
        }

        if (msg.senderName === 'System' || msg.content === 'You were added to this group.' || msg.content === '###GROUP_CREATED###') {
            msg.isSystem = true; 
            msg.content = Number(msg.senderId) === Number(this.currentUserId) ? "You created this group." : "You were added to this group.";
        }
        if (Array.isArray(msg.timestamp)) {
           msg.timestamp = new Date(msg.timestamp[0], msg.timestamp[1] - 1, msg.timestamp[2], msg.timestamp[3], msg.timestamp[4]).toISOString();
        }
        this.ngZone.run(() => {

          const lastClearedId = this.lastClearedMessageId[this.currentRoomId!];
          if (lastClearedId && msg.id <= lastClearedId) {
             return; // Screen par mat dikhao
          }

          const exists = this.messages.some(m => m.id === msg.id);
          if (!exists) {
            this.messages.push({
               ...msg,
               fileUrl: msg.fileUrl || null,
               fileName: msg.fileName || null,
               fileType: msg.fileType || null,
               fileSize: msg.fileSize || null
            });
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

  // =====================================
  // NAYA: MEDIA SHARING HELPERS
  // =====================================
  isImage(fileType: string): boolean {
    return fileType ? fileType.startsWith('image/') : false;
  }

  getFileIcon(fileName: string, fileType: string): string {
    if (!fileName) return 'bi-file-earmark-fill';
    const name = fileName.toLowerCase();
    
    if (name.endsWith('.pdf')) return 'bi-file-earmark-pdf-fill';
    if (name.endsWith('.zip') || name.endsWith('.rar')) return 'bi-file-earmark-zip-fill';
    if (fileType && fileType.startsWith('video/')) return 'bi-file-earmark-play-fill';
    if (name.endsWith('.apk')) return 'bi-android2';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'bi-file-earmark-word-fill';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'bi-file-earmark-excel-fill';
    
    return 'bi-file-earmark-fill';
  }

  formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  openMediaPreview(url: string, type: string, name: string) {
  this.selectedMediaForPreview = { url, type, name };
  }

  closeMediaPreview() {
    this.selectedMediaForPreview = null;
  }

  fetchRoomMedia(roomId: string) {
    this.chatService.getRoomMedia(roomId).subscribe(mediaItems => {
       // Reset arrays
       this.roomMediaFiles = [];
       this.roomLinks = [];
       this.roomDocs = [];

       mediaItems.forEach(item => {
          // 1. Photos aur Videos (Grid ke liye)
          if (item.fileUrl && this.isImage(item.fileType)) {
             this.roomMediaFiles.push(item);
          } 
          // 2. Documents (PDF, ZIP, etc)
          else if (item.fileUrl && !this.isImage(item.fileType)) {
             this.roomDocs.push(item);
          }
          // 3. Links (Content mein HTTP/HTTPS check karein)
          else if (item.content && item.content.includes('http')) {
             // Ek basic regex se url extract kar sakte hain
             const urlRegex = /(https?:\/\/[^\s]+)/g;
             const matches = item.content.match(urlRegex);
             if (matches) {
               matches.forEach((url: string) => {
                 this.roomLinks.push({ url: url, timestamp: item.timestamp, senderName: item.senderUsername || item.senderName });
               });
             }
          }
       });
       this.cdr.detectChanges();
    });
  }

  get filteredUsersForAdd() {
    const query = this.addMemberSearchQuery.toLowerCase();
    return this.allAppUsers.filter(u => u.username.toLowerCase().includes(query)).map(u => {
      return {
        ...u,
        alreadyInGroup: this.groupMembers.some(gm => gm.id === u.id) // Check karta hai group me already hai ya nahi
      };
    });
  }

  openAddMemberModal() {
    this.showAddMemberModal = true;
    this.addMemberSearchQuery = '';
    this.selectedUsersToAdd = [];
    
    // Database se saare users fetch karo
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.get<any[]>('http://localhost:8080/api/users', { headers }).subscribe(users => {
       this.allAppUsers = users.filter(u => !u.username.includes('_DELETED_'));
       this.cdr.detectChanges();
    });
  }

  closeAddMemberModal() {
    this.showAddMemberModal = false;
  }

  toggleUserForAdd(user: any) {
    if (user.alreadyInGroup) return; // Agar already hai to select nahi hone dega
    
    const index = this.selectedUsersToAdd.findIndex(u => u.id === user.id);
    if (index > -1) {
      this.selectedUsersToAdd.splice(index, 1);
    } else {
      this.selectedUsersToAdd.push(user);
    }
  }

  removeSelectedUserForAdd(userId: number) {
    this.selectedUsersToAdd = this.selectedUsersToAdd.filter(u => u.id !== userId);
  }

  submitAddMembers() {
    if (this.selectedUsersToAdd.length === 0 || !this.selectedUser?.isGroup) return;
    
    this.isAddingMembers = true;
    
    // 🛑 MAGIC FIX: Yahan groupId perfectly set ho jayega
    const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));
    const userIds = this.selectedUsersToAdd.map(u => u.id);
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post(`http://localhost:8080/api/groups/${groupId}/members/add?addedById=${this.currentUserId}`, userIds, { headers })
      .subscribe({
         next: () => {
           this.isAddingMembers = false;
           this.closeAddMemberModal();
           
           this.chatService.getGroupMembers(groupId).subscribe(members => {
              members.sort((a, b) => {
                if (a.id === this.currentUserId) return 1;
                if (b.id === this.currentUserId) return -1;
                return a.username.localeCompare(b.username);
              });
              this.groupMembers = members;
              this.cdr.detectChanges();
           });
         },
         error: () => {
           alert("Failed to add members");
           this.isAddingMembers = false;
         }
      });
  }

  onMemberRightClick(event: MouseEvent, member: any) {
    event.preventDefault(); 
    if (!this.isCurrentUserAdmin) return; 
    
   
    if (member.isCreator) return; 
    if (member.id === this.currentUserId) return;

    this.contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      member: member,
      isRemoving: member.isAdmin 
    };
  }

  closeContextMenu() {
    this.contextMenu.show = false;
  }

  makeAdmin() {
    if (!this.contextMenu.member) return;
    const memberId = this.contextMenu.member.id;
    const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));
    this.closeContextMenu(); // Menu turant band kardo

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    // Backend ko signal bhejo admin banane ke liye
    this.http.post(`http://localhost:8080/api/groups/${groupId}/make-admin/${memberId}`, {}, { headers })
      .subscribe({
         next: () => { console.log('Admin request sent'); },
         error: () => { alert('Failed to make admin'); }
      });
  }

  dismissAdmin() {
    if (!this.contextMenu.member) return;
    const memberId = this.contextMenu.member.id;
    const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));
    this.closeContextMenu(); 

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post(`http://localhost:8080/api/groups/${groupId}/dismiss-admin/${memberId}`, {}, { headers })
      .subscribe({
         error: () => { alert('Failed to dismiss admin'); }
      });
  }

  // 🛑 NAYA: Message Dropdown Methods
  toggleMessageDropdown(msgId: number, event: MouseEvent) {
    event.stopPropagation(); // Bubble click ko aage jaane se rokega
    this.activeMessageDropdown = this.activeMessageDropdown === msgId ? null : msgId;
  }

  // Temporary function frontend actions ke liye (Backend baad me judega)
  msgAction(action: string, msg: any) {
    this.activeMessageDropdown = null; // Menu band kardo
    
    switch(action) {
       case 'copy':
         navigator.clipboard.writeText(msg.content);
         console.log('Message Copied');
         break;
       case 'download':
        this.downloadFile(msg.fileUrl, msg.fileName);
        this.activeMessageDropdown = null;
        break;
       case 'reply':
        // NAYA: Service ko message bhej do taaki input box usko catch kar le
        this.chatService.setReplyMessage(msg);
        this.activeMessageDropdown = null;
        break;
       case 'forward':
          this.msgToForward = msg;
          this.activeMessageDropdown = null; // Dropdown chupao
          this.openForwardModal(); // Naya modal open karo
          break;
       case 'pin':
         this.chatService.toggleMessagePin(msg.id, this.currentRoomId!).subscribe({
           error: () => alert('Failed to pin/unpin message')
         });
         break;
       case 'delete':
         if (confirm('Delete this message for everyone?')) {
           this.chatService.softDeleteMessage(msg.id, this.currentRoomId!).subscribe({
             next: () => console.log('Message delete request sent'),
             error: () => alert('Failed to delete message')
           });
         }
         break;
    }
  }

  // ==========================================
  // NAYA: FORWARD MESSAGE LOGIC
  // ==========================================
  openForwardModal() {
    this.showForwardModal = true;
    this.forwardSearchQuery = '';
    this.selectedContactsForForward = [];
    this.allContactsForForward = [];
    this.loadContactsForForward();
  }

  closeForwardModal() {
    this.showForwardModal = false;
    this.msgToForward = null;
  }

  loadContactsForForward() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = { 'Authorization': `Bearer ${token}` };

    // 1. Users fetch karo
    fetch('http://localhost:8080/api/users', { headers })
      .then(res => res.json())
      .then((users: any[]) => {
        const activeUsers = users.filter(u => 
          !u.username.includes('_DELETED_') && 
          Number(u.id) !== Number(this.currentUserId) && 
          // 1-on-1 chat filter logic
          !(this.selectedUser && !this.selectedUser.isGroup && Number(u.id) === Number(this.selectedUser.id)) 
        ).map(u => ({ ...u, isGroup: false, contactId: `USER_${u.id}` }));
        
        this.allContactsForForward = [...this.allContactsForForward, ...activeUsers];
      });

    // 2. Groups fetch karo 
    fetch(`http://localhost:8080/api/groups/user/${this.currentUserId}`, { headers })
      .then(res => res.json())
      .then((groups: any[]) => {
        const activeGroups = groups.filter(g => 
          // Current group filter logic
          !(this.selectedUser && this.selectedUser.isGroup && Number(g.id) === Number(this.selectedUser.id)) 
        ).map(g => ({ 
            ...g, 
            isGroup: true, 
            contactId: `GROUP_${g.id}`, 
            username: g.username || g.name // 🛑 FIX: Agar username nahi hai toh 'name' property use karo
        }));
        
        this.allContactsForForward = [...this.allContactsForForward, ...activeGroups];
      });
  }

  get filteredContactsForForward() {
    if (!this.forwardSearchQuery.trim()) return this.allContactsForForward;
    return this.allContactsForForward.filter(c => 
      c.username.toLowerCase().includes(this.forwardSearchQuery.toLowerCase())
    );
  }

  isForwardSelected(contact: any) {
    return this.selectedContactsForForward.some(c => c.contactId === contact.contactId);
  }

  toggleForwardSelection(contact: any) {
    const index = this.selectedContactsForForward.findIndex(c => c.contactId === contact.contactId);
    if (index > -1) {
      this.selectedContactsForForward.splice(index, 1);
    } else {
      this.selectedContactsForForward.push(contact);
    }
  }

  removeSelectedForward(contactId: string) {
    this.selectedContactsForForward = this.selectedContactsForForward.filter(c => c.contactId !== contactId);
  }

  async submitForward() {
    if (this.selectedContactsForForward.length === 0 || !this.msgToForward) return;
    this.isForwarding = true;

    for (const contact of this.selectedContactsForForward) {
      let targetRoomId = '';
      
      if (contact.isGroup) {
        targetRoomId = `GROUP_${contact.id}`;
      } else {
        try {
          // 1-on-1 chat ke liye room ID nikalna zaroori hai
          const room: any = await this.chatService.getOrCreateRoom(this.currentUserId!, contact.id).toPromise();
          targetRoomId = room.id.toString();
        } catch(e) {
          console.error("Room fetch error", e);
          continue; 
        }
      }

      // Backend ko as-it-is payload bhejo
      const payload: any = {
        content: this.msgToForward.content,
        sender: { id: Number(this.currentUserId) }, // 🛑 NAYA FIX: Sender object format me bheja
        senderId: this.currentUserId,
        roomId: targetRoomId,
        fileUrl: this.msgToForward.fileUrl,
        fileName: this.msgToForward.fileName,
        fileType: this.msgToForward.fileType,
        fileSize: this.msgToForward.fileSize
      };

      // 🛑 NAYA FIX: 1-on-1 ke liye chatRoom object zaroori hai backend ke liye
      if (!targetRoomId.startsWith('GROUP_')) {
          payload.chatRoom = { id: Number(targetRoomId) };
      }

      // 🛑 Yahan 2 arguments bhej diye! (Fix ho gaya)
      this.chatService.sendMessage(targetRoomId, payload);
    }

    this.isForwarding = false;
    this.closeForwardModal();
  }

  // ==========================================
  // NAYA: FILE DOWNLOAD LOGIC
  // ==========================================
  // ==========================================
  // UPDATED: POWERFUL DOWNLOAD LOGIC (Blob Based)
  // ==========================================
  downloadFile(fileUrl: string, fileName: string) {
    if (!fileUrl) return;

    const fullUrl = `http://localhost:8080${fileUrl}`;

    // 🛑 NAYA: Browser ko bypass karke file fetch karna
    fetch(fullUrl)
      .then(response => response.blob()) // File ko blob (binary data) mein badlo
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Isse browser hamesha "Save As" dikhayega
        link.download = fileName || 'downloaded-file';
        
        document.body.appendChild(link);
        link.click();
        
        // Memory saaf karo
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error("Download failed:", err);
        // Fallback: Agar upar wala fail ho toh purana tarika
        window.open(fullUrl, '_blank');
      });
  }


  scrollToMessage(msgId: number) {
    if (!msgId) return;
    
    // HTML element ko ID se dhoondho
    const targetElement = document.getElementById('msg-' + msgId);
    
    if (targetElement) {
      // Smooth scroll karke element ko screen ke beech me lao
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Premium feel: Highlight animation lagao
      targetElement.classList.add('highlight-msg');
      
      // 1.5 second baad highlight hata do
      setTimeout(() => {
        targetElement.classList.remove('highlight-msg');
      }, 1500);
    }
  }

  toggleChatSearch() {
    this.isChatSearchActive = true;
    setTimeout(() => {
      const input = document.querySelector('.search-input-box input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }

  closeChatSearch() {
    this.isChatSearchActive = false;
    this.chatSearchQuery = '';
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.hasSearched = false;
  }

  onSearchTyping() {
    // Agar input khaali kar diya toh clear kar do
    if (!this.chatSearchQuery.trim()) {
       this.searchMatches = [];
       this.currentMatchIndex = -1;
       this.hasSearched = false;
    }
  }

  executeChatSearch() {
    if (!this.chatSearchQuery.trim()) return;
    
    const query = this.chatSearchQuery.toLowerCase();
    
    // 🛑 NAYA LOGIC: Ab ye text aur document/file ka naam DONO mein search karega
    this.searchMatches = this.messages
      .filter(m => {
        // System ya deleted messages ko ignore karo
        if (m.isSystem || m.isDeleted) return false;
        
        // Text me check karo (agar text hai toh)
        const contentMatch = m.content ? m.content.toLowerCase().includes(query) : false;
        
        // File Name me check karo (agar file hai toh)
        const fileNameMatch = m.fileName ? m.fileName.toLowerCase().includes(query) : false;
        
        // Agar dono mein se kisi me bhi match mil gaya, toh usko list me daal lo!
        return contentMatch || fileNameMatch;
      })
      .map(m => m.id);

    this.hasSearched = true;

    if (this.searchMatches.length > 0) {
      // By default sabse recent message par focus karo
      this.currentMatchIndex = this.searchMatches.length - 1;
      this.scrollToCurrentMatch();
    } else {
      this.currentMatchIndex = -1;
    }
  }

  navigateChatSearch(direction: 'up' | 'down') {
    if (this.searchMatches.length === 0) return;

    if (direction === 'up') {
      // 'up' matlab purane messages (array me peeche jana)
      this.currentMatchIndex--;
      if (this.currentMatchIndex < 0) {
        this.currentMatchIndex = this.searchMatches.length - 1; // Cycle loop
      }
    } else {
      // 'down' matlab naye messages (array me aage jana)
      this.currentMatchIndex++;
      if (this.currentMatchIndex >= this.searchMatches.length) {
        this.currentMatchIndex = 0; // Cycle loop
      }
    }
    this.scrollToCurrentMatch();
  }

  scrollToCurrentMatch() {
    const msgId = this.searchMatches[this.currentMatchIndex];
    if (msgId) {
      // Aapka purana scroll & highlight function reuse kar rahe hain!
      this.scrollToMessage(msgId);
    }
  }


  get canSendMessage(): boolean {
    if (!this.selectedUser) return false;
    
    // 1-on-1 Chat: Sirf tabhi allow karo jab user delete na hua ho
    if (!this.selectedUser.isGroup) {
      return !this.selectedUser.isDeleted;
    }
    
    // Group Chat: Permissions check karo
    const perms = this.selectedUser.permissions || '';
    if (perms.toLowerCase().includes('admin')) {
      return this.isCurrentUserAdmin;
    }
    
    return true; // Everyone can send
  }

  get showAdminRestrictedFooter(): boolean {
    if (!this.selectedUser || !this.selectedUser.isGroup) return false;
    
    const perms = this.selectedUser.permissions || '';
    if (perms.toLowerCase().includes('admin') && !this.isCurrentUserAdmin) {
      return true;
    }
    return false;
  }

  applyGroupSettings() {
    if (!this.selectedUser?.isGroup || !this.currentUserId) return;
    this.isApplyingSettings = true;
    
    const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.put(`http://localhost:8080/api/groups/${groupId}/permissions`, { permissions: this.selectedGroupPermission }, { headers })
      .subscribe({
        next: () => {
          this.isApplyingSettings = false;
          this.isGroupSettingsExpanded = false; // Setting apply hote hi panel band kar do
        },
        error: () => {
          this.isApplyingSettings = false;
          alert('Failed to update group settings');
        }
      });
  }

  get pinnedMessages() {
    return this.messages.filter(m => m.isPinned && !m.isDeleted);
  }

  togglePinnedView() {
    this.isPinnedExpanded = !this.isPinnedExpanded;
    if (this.isPinnedExpanded && this.pinnedMessages.length > 0) {
      this.currentPinnedIndex = this.pinnedMessages.length - 1; // Khulte hi sabse latest pinned msg dikhe
    }
  }

  navigatePinned(direction: 'up' | 'down', event: MouseEvent) {
    event.stopPropagation();
    if (direction === 'up' && this.currentPinnedIndex > 0) {
      this.currentPinnedIndex--;
    } else if (direction === 'down' && this.currentPinnedIndex < this.pinnedMessages.length - 1) {
      this.currentPinnedIndex++;
    }
  }

  scrollToPinned(event: MouseEvent) {
    event.stopPropagation();
    if (this.pinnedMessages.length > 0) {
      this.scrollToMessage(this.pinnedMessages[this.currentPinnedIndex].id);
    }
  }

  openDeleteGroupModal() { this.showDeleteGroupModal = true; }
  closeDeleteGroupModal() { this.showDeleteGroupModal = false; }

  confirmDeleteGroup() {
    if (!this.selectedUser?.isGroup) return;
    this.isDeletingGroup = true;
    const groupId = Number(String(this.selectedUser.id).replace('GROUP_', ''));

    this.chatService.deleteGroup(groupId).subscribe({
      next: () => {
        this.isDeletingGroup = false;
        this.closeDeleteGroupModal();
        
        // 🛑 NAYA FIX: Admin ki screen par turant chat band karo aur sidebar ko signal bhejo
        this.selectedUser = null;
        this.currentRoomId = null;
        this.showProfilePanel = false; 
        
        this.chatService.triggerNotification({ type: 'GROUP_DELETED', groupId: groupId });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isDeletingGroup = false;
        alert("Failed to delete group");
      }
    });
  }

}