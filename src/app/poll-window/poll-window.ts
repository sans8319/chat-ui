import { Component, OnInit, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // 🛑 NAYA: Http Client import
import { ChatService } from '../services/chat';

@Component({
  selector: 'app-poll-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './poll-window.html',
  styleUrl: './poll-window.scss'
})
export class PollWindowComponent implements OnInit {
  pollQuestion: string = '';
  pollDescription: string = '';
  isCreating: boolean = false;

  departments: string[] = [];
  isLoadingDepartments: boolean = false;
  isDeptDropdownOpen: boolean = false;
  selectedDepartment: string = '';

  // 🛑 NAYA: Specific Employees ke variables
  allUsers: any[] = [];
  selectedSpecificUsers: any[] = [];
  isUserDropdownOpen: boolean = false;
  userSearchQuery: string = '';
  
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

  constructor(
    private chatService: ChatService,
    private http: HttpClient, // 🛑 NAYA: Inject
    @Inject(PLATFORM_ID) private platformId: Object // 🛑 NAYA: Inject
  ) {}

  ngOnInit() {
    this.fetchDepartments();
    this.fetchAllUsers();
    this.minDateObj.setHours(0,0,0,0); // Aaj ki date set ki 
    this.generateCalendar(); // Calendar load kiya
  }

  fetchDepartments() {
    this.isLoadingDepartments = true;
    this.chatService.getDepartments().subscribe({
      next: (data) => { this.departments = data; this.isLoadingDepartments = false; },
      error: () => { this.departments = []; this.isLoadingDepartments = false; }
    });
  }

  // 🛑 NAYA: Backend se Users fetch karna
  fetchAllUsers() {
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const currentUserId = isPlatformBrowser(this.platformId) ? localStorage.getItem('userId') : '';

    this.http.get<any[]>('http://localhost:8080/api/users', { headers }).subscribe(users => {
       // Filter out deleted users and current logged-in user
       this.allUsers = users.filter(u => 
         !u.username.includes('_DELETED_') && String(u.id) !== currentUserId
       );
    });
  }

  // 🛑 NAYA: Search Filter function
  get filteredUsers() {
    if (!this.userSearchQuery.trim()) return this.allUsers;
    return this.allUsers.filter(u => 
      u.username.toLowerCase().includes(this.userSearchQuery.toLowerCase())
    );
  }

  // 🛑 NAYA: User ko Select/Deselect karna
  toggleUserSelection(user: any) {
    const index = this.selectedSpecificUsers.findIndex(u => u.id === user.id);
    if (index > -1) {
      this.selectedSpecificUsers.splice(index, 1); // Remove if already selected
    } else {
      this.selectedSpecificUsers.push(user); // Add if not selected
    }
  }

  // 🛑 NAYA: Pill chip se remove karna
  removeSpecificUser(userId: number) {
    this.selectedSpecificUsers = this.selectedSpecificUsers.filter(u => u.id !== userId);
  }

  // 🛑 NAYA: Profile picture parse karna (Avatars aur Backgrounds ke liye)
  parseProfilePicture(path: string) {
    if (!path) return { isImage: false, isAvatar: false };
    if (path.startsWith('/uploads/')) return { isImage: true, url: `http://localhost:8080${path}` };
    if (path.includes('|')) {
      const parts = path.split('|');
      return { isImage: false, isAvatar: true, bg: parts[0], icon: parts[1] };
    }
    return { isImage: false, isAvatar: false };
  }

  // BAAKI PURANE FUNCTIONS (As it is safe)
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
    this.showCalendar = false; // 🛑 NAYA: Bahar click hone par calendar band
  }

  createPoll() {
    this.isCreating = true; // Loader chalu

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
      
      options: this.pollOptions.map(opt => ({
        text: opt.text,
        fileSize: opt.file ? opt.file.size : null
      }))
    };

    formData.append('pollData', JSON.stringify(pollPayload));

    this.pollOptions.forEach(opt => {
      if (opt.file) {
        formData.append('files', opt.file);
      }
    });

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post('http://localhost:8080/api/polls/create', formData, { headers }).subscribe({
      next: (res) => {
        alert("Poll Created Successfully! 🚀");
        this.isCreating = false; // Loader band
        // Yahan par hum form ko reset ya close karne ka logic daal sakte hain baad mein
      },
      error: (err) => {
        console.error(err);
        alert("Failed to create poll.");
        this.isCreating = false; // Loader band
      }
    });
  }

  generateCalendar() {
    this.calendarDays = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    // Pichle mahine ke bache hue din
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth - 1, daysInPrevMonth - i);
      this.calendarDays.push({ date: d.getDate(), isCurrentMonth: false, isPast: d < this.minDateObj, fullDate: this.formatDate(d) });
    }
    // Is mahine ke din
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(this.currentYear, this.currentMonth, i);
      this.calendarDays.push({ date: i, isCurrentMonth: true, isPast: d < this.minDateObj, fullDate: this.formatDate(d) });
    }
    // Agle mahine ke shuruaati din (Grid puri karne ke liye)
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
}