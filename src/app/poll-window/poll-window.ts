import { Component, OnInit, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatService } from '../services/chat';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; // 🛑 YAHAN ADD KIYA
import { API_CONFIG } from '../config/api-config'; // 🛑 YAHAN ADD KIYA

@Component({
  selector: 'app-poll-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './poll-window.html',
  styleUrl: './poll-window.scss'
})
export class PollWindowComponent implements OnInit {
  
  selectedPoll: any = null;
  selectedOptions: number[] = [];


  pollQuestion: string = '';
  pollDescription: string = '';
  isCreating: boolean = false;

  departments: string[] = [];
  isLoadingDepartments: boolean = false;
  isDeptDropdownOpen: boolean = false;
  selectedDepartment: string = '';

  allUsers: any[] = [];
  selectedSpecificUsers: any[] = [];
  isUserDropdownOpen: boolean = false;
  userSearchQuery: string = '';

  previewFileUrl: SafeResourceUrl | null = null;
  previewFileName: string = '';
  isImagePreview: boolean = false;
  isPreviewSupported: boolean = true;
  pollOptions: any[] = [
    { text: '', file: null },
    { text: '', file: null },
    { text: '', file: null }
  ];

  selectedType: 'single' | 'multiple' = 'single';
  selectedAudience: 'all' | 'department' | 'specific' = 'all';
  selectedVisibility: 'anonymous' | 'public' = 'anonymous';

  selectedExpiryDate: string = '';
  showCalendar: boolean = false;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  calendarDays: any[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
  minDateObj = new Date();

  pollCommentsMap: { [pollId: number]: string } = {};

  toastMessage: string = '';
  showToast: boolean = false;

  showMyCreatedPolls: boolean = false;
  myCreatedPolls: any[] = [];


  showPollAnalytics: boolean = false;
  analyticsPoll: any = null;
  
  // Premium Colors for Pie Chart & Legend
  pollColors: string[] = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9', '#f43f5e'];

  currentUserId: number | null = null;

  allMyCreatedPolls: any[] = [];
  showMatrixFilterMenu: boolean = false;
  activeMatrixFilter: 'all' | 'active' | 'closed' = 'all';


  constructor(
    public chatService: ChatService, 
    private http: HttpClient, 
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.currentUserId = Number(localStorage.getItem('userId'));
    this.fetchDepartments();
    this.fetchAllUsers();
    this.minDateObj.setHours(0,0,0,0); 
    this.generateCalendar(); 

    
    this.chatService.selectedPoll$.subscribe(poll => {
      this.selectedPoll = poll;
      this.selectedOptions = []; 

      if (poll) {
        
        this.showPollAnalytics = false; 
        this.showMyCreatedPolls = false;
        
        if (!this.pollCommentsMap[poll.id]) {
          this.pollCommentsMap[poll.id] = '';
        }
      } else {
       
        this.showPollAnalytics = false;
      }
    });


    this.chatService.showMyPolls$.subscribe(show => {
      this.showMyCreatedPolls = show;
      if (show) {
  
        this.showPollAnalytics = false; 
        this.selectedPoll = null; 
        
        const currentUserId = Number(localStorage.getItem('userId'));
        this.loadMyPolls(currentUserId);
      }
    });
    
    this.chatService.notificationUpdate$.subscribe(notif => {
      if (notif && (notif.type === 'NEW_POLL' || notif.type === 'VOTE_SUBMITTED')) {
        setTimeout(() => {
          const currentUserId = Number(localStorage.getItem('userId'));
          
          if (this.showPollAnalytics && this.analyticsPoll) {
            this.chatService.getPollsForUser(currentUserId).subscribe(polls => {
              const updatedPoll = polls.find(p => p.id === this.analyticsPoll.id);
              if (updatedPoll) this.analyticsPoll = updatedPoll;
            });
          }
          
          this.loadMyPolls(currentUserId);
        }, 500);
      }
    });
  }


  closeVoting() {
    this.chatService.setSelectedPoll(null);
  }

  getCreatorName(poll: any): string {
    if (!poll) return '';
    const currentUserId = Number(localStorage.getItem('userId'));
    if (Number(poll.createdBy) === currentUserId) return 'by You';
    return poll.createdByUsername ? `by ${poll.createdByUsername}` : `by User ${poll.createdBy}`; 
  }

  isPollActive(poll: any): boolean {
    if (!poll) return false;
    if (!poll.active) return false;
    const expiry = new Date(poll.expiryDate).getTime();
    return expiry > new Date().getTime(); 
  }

  toggleOption(optionId: number) {
    if (!this.selectedPoll) return;

    if (!this.isPollActive(this.selectedPoll)) {
      this.showCustomAlert("This poll has been expired! You can no longer vote.");
      return;
    }
    
    if (this.selectedPoll.pollType === 'single') {
      
      if (this.selectedOptions.includes(optionId)) {
        this.selectedOptions = []; // Unselect
      } else {
        this.selectedOptions = [optionId]; // Select new
      }
    } else {
      
      const index = this.selectedOptions.indexOf(optionId);
      index > -1 ? this.selectedOptions.splice(index, 1) : this.selectedOptions.push(optionId);
    }
  }

  isOptionSelected(optionId: number): boolean {
    return this.selectedOptions.includes(optionId);
  }

  getMediaIcon(fileType: string): string {
    if (!fileType) return 'bi-file-earmark-text-fill text-secondary';
    if (fileType.includes('pdf')) return 'bi-file-earmark-pdf-fill text-danger';
    if (fileType.includes('image')) return 'bi-image-fill text-info';
    if (fileType.includes('video')) return 'bi-camera-video-fill text-purple';
    if (fileType.includes('zip') || fileType.includes('rar')) return 'bi-file-earmark-zip-fill text-warning';
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return 'bi-file-earmark-excel-fill text-success';
    if (fileType.includes('document') || fileType.includes('word')) return 'bi-file-earmark-word-fill text-primary';
    return 'bi-file-earmark-text-fill text-secondary';
  }


  fetchDepartments() {
    this.isLoadingDepartments = true;
    this.chatService.getDepartments().subscribe({
      next: (data) => { this.departments = data; this.isLoadingDepartments = false; },
      error: () => { this.departments = []; this.isLoadingDepartments = false; }
    });
  }

  fetchAllUsers() {
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const currentUserId = isPlatformBrowser(this.platformId) ? localStorage.getItem('userId') : '';

    this.http.get<any[]>(`${API_CONFIG.BASE_URL}/api/users`, { headers }).subscribe(users => {
       this.allUsers = users.filter(u => !u.username.includes('_DELETED_') && String(u.id) !== currentUserId);
    });
  }

  get filteredUsers() {
    if (!this.userSearchQuery.trim()) return this.allUsers;
    return this.allUsers.filter(u => u.username.toLowerCase().includes(this.userSearchQuery.toLowerCase()));
  }

  toggleUserSelection(user: any) {
    const index = this.selectedSpecificUsers.findIndex(u => u.id === user.id);
    if (index > -1) { this.selectedSpecificUsers.splice(index, 1); } 
    else { this.selectedSpecificUsers.push(user); }
  }

  removeSpecificUser(userId: number) {
    this.selectedSpecificUsers = this.selectedSpecificUsers.filter(u => u.id !== userId);
  }

  parseProfilePicture(path: string) {
    if (!path) return { isImage: false, isAvatar: false };
    if (path.startsWith('/uploads/')) return { isImage: true, url: `${API_CONFIG.BASE_URL}${path}` };
    if (path.includes('|')) {
      const parts = path.split('|');
      return { isImage: false, isAvatar: true, bg: parts[0], icon: parts[1] };
    }
    return { isImage: false, isAvatar: false };
  }

  addOption() { this.pollOptions.push({ text: '', file: null }); }

  removeOption(index: number) {
    if (this.pollOptions.length > 2) this.pollOptions.splice(index, 1);
    else alert("A poll must have at least 2 options.");
  }

  onFileSelected(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) { alert("⚠️ File size exceeds 500MB limit."); event.target.value = ''; return; }
      this.pollOptions[index].file = file;
      if (!this.pollOptions[index].text) this.pollOptions[index].text = file.name;
    }
  }

  removeFile(index: number) { this.pollOptions[index].file = null; this.pollOptions[index].text = ''; }

  getFileIcon(fileName: string): string {
    if (!fileName) return 'bi-file-earmark-fill text-secondary';
    const name = fileName.toLowerCase();
    if (name.endsWith('.pdf')) return 'bi-file-earmark-pdf-fill text-danger';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'bi-file-earmark-word-fill text-primary';
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'bi-file-earmark-excel-fill text-success';
    if (name.endsWith('.zip') || name.endsWith('.rar')) return 'bi-file-earmark-zip-fill text-warning';
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'bi-file-earmark-image-fill text-info';
    if (name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.mov')) return 'bi-file-earmark-play-fill text-purple';
    if (name.endsWith('.txt')) return 'bi-file-earmark-text-fill text-secondary';
    return 'bi-file-earmark-fill text-secondary'; 
  }

  formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  trackByIndex(index: number, obj: any): any { return index; }

  @HostListener('document:click')
  closeDropdowns() {
    this.isDeptDropdownOpen = false;
    this.isUserDropdownOpen = false;
    this.showCalendar = false; 
    this.showMatrixFilterMenu = false;
  }

  createPoll() {

    if (!this.pollQuestion || !this.pollQuestion.trim()) {
      return this.showCustomAlert('Please enter a poll question.');
    }


    const validOptions = this.pollOptions.filter(opt => opt.text.trim() || opt.file);
    if (validOptions.length < 2) {
      return this.showCustomAlert('Please provide at least 2 valid options.');
    }

    if (!this.selectedExpiryDate) {
      return this.showCustomAlert('Please select an expiration date for the poll.');
    }

    if (this.selectedAudience === 'department' && !this.selectedDepartment) {
      return this.showCustomAlert('Please select a target department.');
    }

    if (this.selectedAudience === 'specific' && this.selectedSpecificUsers.length === 0) {
      return this.showCustomAlert('Please select at least one specific employee.');
    }


    this.isCreating = true; 

    const formData = new FormData();

    const pollPayload = {
      question: this.pollQuestion,
      description: this.pollDescription,
      pollType: this.selectedType,
      targetedAudience: this.selectedAudience,
      expiryDate: this.selectedExpiryDate ? `${this.selectedExpiryDate}T23:59:59` : null,
      visibility: this.selectedVisibility,
      targetDepartments: this.selectedAudience === 'department' ? [this.selectedDepartment] : [],
      targetUsers: this.selectedAudience === 'specific' ? this.selectedSpecificUsers.map(u => u.id) : [],
      createdBy: localStorage.getItem('userId'),
      
      options: validOptions.map(opt => ({ // Sirf valid options bhejenge
        text: opt.text,
        fileSize: opt.file ? opt.file.size : null
      }))
    };

    formData.append('pollData', JSON.stringify(pollPayload));

    validOptions.forEach(opt => {
      if (opt.file) { formData.append('files', opt.file); }
    });

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post(`${API_CONFIG.BASE_URL}/api/polls/create`, formData, { headers }).subscribe({
      next: (res) => {
        this.showCustomAlert("Poll Created Successfully! 🚀"); // Professional alert
        
    
        this.chatService.triggerNotification({ type: 'NEW_POLL' }); 

        this.isCreating = false; 
        this.resetForm(); // Form khali karne ke liye (agar aapne function banaya hai)
      },
      error: (err) => {
        console.error(err);
        this.showCustomAlert("Failed to create poll. Please try again.");
        this.isCreating = false; 
      }
    });
  }

  generateCalendar() {
    this.calendarDays = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth - 1, daysInPrevMonth - i);
      this.calendarDays.push({ date: d.getDate(), isCurrentMonth: false, isPast: d < this.minDateObj, fullDate: this.formatDate(d) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(this.currentYear, this.currentMonth, i);
      this.calendarDays.push({ date: i, isCurrentMonth: true, isPast: d < this.minDateObj, fullDate: this.formatDate(d) });
    }
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(this.currentYear, this.currentMonth + 1, i);
      this.calendarDays.push({ date: i, isCurrentMonth: false, isPast: false, fullDate: this.formatDate(d) });
    }
  }

  formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  prevMonth() {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; } 
    else { this.currentMonth--; }
    this.generateCalendar();
  }

  nextMonth() {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; } 
    else { this.currentMonth++; }
    this.generateCalendar();
  }

  selectDate(fullDate: string) {
    this.selectedExpiryDate = fullDate;
    this.showCalendar = false;
  }

  getMonthName(): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[this.currentMonth];
  }

  get formattedExpiryDate(): string {
    if (!this.selectedExpiryDate) return '';
    const d = new Date(this.selectedExpiryDate);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // 🛑 NAYA FUNCTION: Image ka pura (full) URL banane ke liye
  getFullImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url; 
    return `${API_CONFIG.BASE_URL}${url}`;   
  }

  // 🛑 NAYE FUNCTIONS (Ugly MIME type hatane aur Preview open karne ke liye)
  getReadableExtension(fileName: string): string {
    if (!fileName) return 'FILE';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';
  }

  openPreview(opt: any, event: Event) {
    event.stopPropagation();
    if (!opt.fileUrl) return;

    const fullUrl = this.getFullImageUrl(opt.fileUrl);
    this.previewFileName = opt.fileName || 'Document';
    
    const fileName = (opt.fileName || '').toLowerCase();
    const fileType = (opt.fileType || '').toLowerCase();
    
    this.isImagePreview = fileType.includes('image');
    const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf');

    if (this.isImagePreview) {
      // Images aaram se load ho jati hain, unhe iframe ki dikkat nahi hoti
      this.isPreviewSupported = true;
      this.previewFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
      
    } else if (isPdf) {
      // 🛑 NAYA FIX: PDF ke liye Blob approach (Taki 'refused to connect' na aaye)
      this.isPreviewSupported = true;
      
      // PDF ko raw data ki tarah fetch kar rahe hain
      this.http.get(fullUrl, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          // Us raw data ka ek safe internal URL banaya
          const objectUrl = URL.createObjectURL(blob);
          this.previewFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
        },
        error: (err) => {
          console.error('PDF preview load failed:', err);
          // Agar kisi wajah se blob load na ho, toh fallback me download karwa do
          window.open(fullUrl, '_blank');
          this.closePreview();
        }
      });
      
    } else {
      // DOC, DOCX etc ke liye wahi purana error message aur auto-download
      this.isPreviewSupported = false;
      this.previewFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl); 
      window.open(fullUrl, '_blank'); 
    }
  }

  closePreview() {
    this.previewFileUrl = null;
  }

  submitVote() {
    // 🛑 NAYA FIX: Submit karne se pehle bhi check karo ki poll expired toh nahi hai
    if (!this.isPollActive(this.selectedPoll)) {
      this.showCustomAlert("This poll has been expired! You can no longer vote.");
      return;
    }

    // 1. Validation: Kam se kam ek option select hona chahiye (Browser alert hata diya)
    if (this.selectedOptions.length === 0) {
      this.showCustomAlert("Please select at least one option.");
      return;
    }

    // 2. Poll ID aur User ID nikalna
    const currentPollId = this.selectedPoll.id; 
    const currentUserId = localStorage.getItem('userId');
    
    // 3. Final Payload (selected poll ka specific comment map se uthayenge)
    const votePayload = {
      poll: { id: currentPollId },
      userId: Number(currentUserId),
      selectedOptionIds: this.selectedOptions,
      comment: this.pollCommentsMap[currentPollId] || '', 
    };

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post(`${API_CONFIG.BASE_URL}/api/polls/vote`, votePayload, { headers }).subscribe({
      next: (res) => {
        // 🛑 FIX: Premium Alert lagaya
        this.showCustomAlert("Vote submitted successfully! ✅");

        delete this.pollCommentsMap[currentPollId]; 
        this.selectedOptions = []; 
        
        // Sidebar refresh signal
        this.chatService.triggerNotification({ type: 'VOTE_SUBMITTED' });

        this.closeVoting(); 
      },
      error: (err) => {
        console.error(err);
        // 🛑 FIX: Error ke liye bhi premium alert lagaya
        this.showCustomAlert(err.error || "Failed to submit vote. Maybe you already voted!");
      }
    });
  }


  getOptionStats(opt: any) {
    if (!this.selectedPoll) return { percentage: 0, showAnalytics: false, votes: 0 };

    // Sirf backend se aane wale real votes ko hi count karenge
    let baseTotal = this.selectedPoll.options.reduce((sum: number, o: any) => sum + (o.voteCount || 0), 0);
    let optVotes = opt.voteCount || 0;

    let isTempSelected = this.selectedOptions.includes(opt.id);

    // 🛑 NAYA FIX: Yahan se temporary +1 wala logic hata diya gaya hai.
    // Ab percentage sirf pure existing votes par calculate hoga.
    let percentage = baseTotal === 0 ? 0 : Math.round((optVotes / baseTotal) * 100);

    // Kab dikhana hai? 
    // 1. Agar poll pehle hi submit ho chuka hai (Permanent view)
    // 2. Agar current voting session me user ne isko select kiya hai (Temp view)
    let showAnalytics = this.selectedPoll.userVoted || isTempSelected;

    return { percentage, showAnalytics, votes: optVotes };
  }

  // 🛑 NAYA FUNCTION: Dynamic sliding transparent color banane ke liye
  getOptionBackground(opt: any): string {
    const stats = this.getOptionStats(opt);
    if (!stats.showAnalytics) return ''; // Default background rakho

    // Premium light Indigo transparent color (#6366f1 at 10% opacity)
    return `linear-gradient(to right, rgba(99, 102, 241, 0.15) ${stats.percentage}%, transparent ${stats.percentage}%)`;
  }

  // 🛑 NAYA FUNCTION: Insight box ke liye selected options ka data nikalna
  getSelectedOptionInsights() {
    // Agar poll submit ho chuka hai ya koi option select nahi hai, toh kuch mat dikhao
    if (!this.selectedPoll || this.selectedPoll.userVoted || this.selectedOptions.length === 0) {
      return [];
    }
    
    // Jo options select kiye hain, unka Text aur Percentage nikal lo
    return this.selectedPoll.options
      .filter((opt: any) => this.selectedOptions.includes(opt.id))
      .map((opt: any) => {
         const stats = this.getOptionStats(opt);
         // Agar text hai toh wo lo, nahi toh file ka naam
         const optName = opt.text || opt.fileName || 'Attachment';
         return { name: optName, percentage: stats.percentage };
      });
  }

  // 🛑 NAYA FUNCTION: Premium Alert Dikhane ke liye
  showCustomAlert(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3500); // 3.5 seconds baad khud gayab ho jayega
  }

  loadMyPolls(userId: number) {
    this.chatService.getPollsForUser(userId).subscribe(polls => {
      let created = polls.filter(p => Number(p.createdBy) === userId);
      this.allMyCreatedPolls = created;
      this.applyMatrixFilter(); 
    });
  }

  getTotalVotes(poll: any): number {
    return poll.options?.reduce((sum: number, opt: any) => sum + (opt.voteCount || 0), 0) || 0;
  }

  // 🛑 NAYA FIX: Missing Helper functions for "My Created Polls" Grid

  getIconData(pollId: number) {
    const icons = ['bi-bar-chart-fill', 'bi-pie-chart-fill', 'bi-ui-radios', 'bi-list-check', 'bi-patch-question-fill'];
    const bgs = ['bg-purple', 'bg-green', 'bg-blue', 'bg-pink', 'bg-orange'];
    const index = (pollId || 0) % 5;
    return { icon: icons[index], bg: bgs[index] };
  }

  getExpiryStatus(expiryDateStr: string): string {
    if (!expiryDateStr) return 'No expiry set';
    
    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;
    
    const oneHour = 1000 * 60 * 60;
    const oneDay = oneHour * 24;

    if (diff > 0) {
      if (diff > oneDay) {
        const days = Math.floor(diff / oneDay);
        return `Expiring in ${days} day${days > 1 ? 's' : ''}`;
      } else if (diff > oneHour) {
        const hours = Math.floor(diff / oneHour);
        return `Expiring in ${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        const mins = Math.floor(diff / (1000 * 60));
        return `Expiring in ${mins} min${mins > 1 ? 's' : ''}`;
      }
    } else {
      const pastDiff = Math.abs(diff);
      if (pastDiff > oneDay) {
        const days = Math.floor(pastDiff / oneDay);
        return `Expired ${days} day${days > 1 ? 's' : ''} ago`;
      } else if (pastDiff > oneHour) {
        const hours = Math.floor(pastDiff / oneHour);
        return `Expired ${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const mins = Math.floor(pastDiff / (1000 * 60));
        return `Expired ${mins} min${mins > 1 ? 's' : ''} ago`;
      }
    }
  }

  // 🛑 NAYA FIX: Reset Form function jo success ke baad saare fields saaf karega
  resetForm() {
    this.pollQuestion = '';
    this.pollDescription = '';
    this.selectedExpiryDate = '';
    this.selectedDepartment = '';
    this.selectedSpecificUsers = [];
    this.selectedAudience = 'all';
    this.selectedType = 'single';
    this.selectedVisibility = 'anonymous';
    
    // Options ko wapas default 3 khali options par le aao
    this.pollOptions = [
      { text: '', file: null },
      { text: '', file: null },
      { text: '', file: null }
    ];
    
    // Calendar aur dropdowns band kar do
    this.showCalendar = false;
    this.isDeptDropdownOpen = false;
    this.isUserDropdownOpen = false;
  }

  // 🛑 NAYA: Analytics Functions
  openAnalytics(poll: any) {
    this.showMyCreatedPolls = false; // Matrix band karo
    this.selectedPoll = null; // Voting view band karo
    this.showPollAnalytics = true; // Analytics kholo
    this.analyticsPoll = poll;
  }

  closeAnalytics() {
    this.showPollAnalytics = false;
    this.showMyCreatedPolls = true; // Wapas Matrix par jao
    this.analyticsPoll = null;
  }

  getOptionColor(index: number): string {
    return this.pollColors[index % this.pollColors.length];
  }

  // 🛑 MAGIC: CSS Pie Chart Gradient Generator
  getPieChartGradient(): string {
    if (!this.analyticsPoll || !this.analyticsPoll.options) return 'conic-gradient(#e2e8f0 0% 100%)';
    const total = this.getTotalVotes(this.analyticsPoll);
    if (total === 0) return 'conic-gradient(#e2e8f0 0% 100%)';

    let gradientSteps: string[] = [];
    let currentPercentage = 0;

    this.analyticsPoll.options.forEach((opt: any, index: number) => {
      const count = opt.voteCount || 0;
      if (count > 0) {
        const percent = (count / total) * 100;
        const color = this.getOptionColor(index);
        gradientSteps.push(`${color} ${currentPercentage}% ${currentPercentage + percent}%`);
        currentPercentage += percent;
      }
    });

    return `conic-gradient(${gradientSteps.join(', ')})`;
  }

  getAudienceText(poll: any): string {
    if (poll.targetedAudience === 'all') return 'All Employees';
    if (poll.targetedAudience === 'department') return `Dept: ${poll.targetDepartments?.[0] || 'Selected'}`;
    if (poll.targetedAudience === 'specific') return `${poll.targetUsers?.length || 'Specific'} Employees`;
    return 'Everyone';
  }

  // 🛑 NAYA: Votes mein se comments nikalne ke liye
  getPollComments(poll: any) {
    if (!poll || !poll.votes) return [];
    return poll.votes.filter((v: any) => v.comment && v.comment.trim() !== '');
  }

  // 🛑 NAYA FIX: Option ki DB ID se uska sahi color nikalne ke liye
  getVoteColor(optionId: number): string {
    if (!this.analyticsPoll || !this.analyticsPoll.options) return '#cbd5e1'; // Default grey
    
    // Option ID ko poll.options array mein dhoondho
    const index = this.analyticsPoll.options.findIndex((opt: any) => opt.id === optionId);
    
    // Agar mil gaya toh uska exact color return karo
    return index !== -1 ? this.getOptionColor(index) : '#cbd5e1';
  }

  sortPinnedPolls(polls: any[]) {
    const currentUserId = localStorage.getItem('userId');
    const pinned = JSON.parse(localStorage.getItem(`pinnedPolls_${currentUserId}`) || '[]');

    return polls.sort((a, b) => {
      const aPinned = pinned.includes(a.id);
      const bPinned = pinned.includes(b.id);

      if (aPinned && !bPinned) return -1; // Pinned poll hamesha upar
      if (!aPinned && bPinned) return 1;  // Unpinned neeche

      // Agar dono pinned hain ya dono unpinned hain, toh naya poll upar aayega
      return b.id - a.id; 
    });
  }

  // 🛑 NAYA FUNCTION: Check karne ke liye ki poll pinned hai ya nahi
  isPollPinned(pollId: number): boolean {
    const currentUserId = localStorage.getItem('userId');
    const pinned = JSON.parse(localStorage.getItem(`pinnedPolls_${currentUserId}`) || '[]');
    return pinned.includes(pollId);
  }


  togglePinPoll(poll: any, event: Event) {
    event.stopPropagation(); // Card open hone se rokne ke liye
    
    const currentUserId = localStorage.getItem('userId');
    const storageKey = `pinnedPolls_${currentUserId}`;
    let pinned = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (pinned.includes(poll.id)) {
      pinned = pinned.filter((id: number) => id !== poll.id); // Unpin
    } else {
      pinned.push(poll.id); // Pin
    }

    localStorage.setItem(storageKey, JSON.stringify(pinned));
    
    
    this.myCreatedPolls = this.sortPinnedPolls([...this.myCreatedPolls]); 
  }

  applyMatrixFilter() {
    let filtered = [...this.allMyCreatedPolls];
    
    if (this.activeMatrixFilter === 'active') {
      filtered = filtered.filter(p => this.isPollActive(p));
    } else if (this.activeMatrixFilter === 'closed') {
      filtered = filtered.filter(p => !this.isPollActive(p));
    }
    
    this.myCreatedPolls = this.sortPinnedPolls(filtered); 
  }


  toggleMatrixFilter(event: Event) {
    event.stopPropagation();
    
    if (this.activeMatrixFilter !== 'all') {

      this.activeMatrixFilter = 'all';
      this.showMatrixFilterMenu = false;
      this.applyMatrixFilter();
    } else {

      this.showMatrixFilterMenu = !this.showMatrixFilterMenu;
    }
  }


  setMatrixFilter(filterType: 'active' | 'closed', event: Event) {
    event.stopPropagation();
    this.activeMatrixFilter = filterType;
    this.showMatrixFilterMenu = false;
    this.applyMatrixFilter();
  }

}