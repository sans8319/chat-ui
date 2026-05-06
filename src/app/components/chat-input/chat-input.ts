import { Component, Input, Inject, PLATFORM_ID, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatService } from '../../services/chat';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.scss'
})
export class ChatInputComponent {
  readonly String = String;
  @Input() roomId: string | null = null; 
  messageText: string = '';

  // NAYA: Multi-File Media States
  isDragging = false;
  selectedFiles: { file: File, previewUrl: string | null }[] = [];
  isUploading = false;

  // =====================================
  // NAYA: ATTACHMENT MENU VARIABLES
  // =====================================
  showAttachmentMenu = false;
  @ViewChild('fileInput') fileInput!: ElementRef;

  replyToMessage: any = null;
  currentUserIdStr: string | null = null;

  constructor(
    private chatService: ChatService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.currentUserIdStr = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    
    // Service se reply message suno
    this.chatService.replyMessage$.subscribe(msg => {
      this.replyToMessage = msg;
    });
  }

  cancelReply() {
    this.chatService.clearReplyMessage();
  }

  
  toggleAttachmentMenu() {
    this.showAttachmentMenu = !this.showAttachmentMenu;
  }

  closeAttachmentMenu() {
    this.showAttachmentMenu = false;
  }

  // Agar user bahar click kare toh menu band ho jaye
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Agar click .attachment-container ke andar NAHI hua hai, toh band karo
    if (!target.closest('.attachment-container')) {
      this.closeAttachmentMenu();
    }
  }

  triggerFileInput(type: 'document' | 'media') {
    this.closeAttachmentMenu();
    
    // Type ke hisaab se allowed files set karein
    if (type === 'media') {
      this.fileInput.nativeElement.accept = 'image/*,video/*';
    } else {
      // Document type mein sab kuch allow karo, ya specific extensions de do
      this.fileInput.nativeElement.accept = '.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.apk,*'; 
    }
    
    // File picker open karo
    this.fileInput.nativeElement.click();
  }

  // =====================================
  // TEXT & KEYBOARD LOGIC
  // =====================================
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) return; 
      event.preventDefault();
      this.sendMessage();
    }
  }

  // =====================================
  // DRAG & DROP LOGIC
  // =====================================
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFiles(event.target.files);
    }
    event.target.value = ''; 
  }

  // NAYA: Ek sath multiple files handle karne ka logic
  handleFiles(files: FileList | File[]) {
    Array.from(files).forEach(file => {
      if (file.size > 25 * 1024 * 1024) { 
        alert(`File ${file.name} exceeds 25MB limit.`);
        return;
      }
      
      if (this.isImage(file)) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedFiles.push({ file, previewUrl: e.target.result });
        };
        reader.readAsDataURL(file);
      } else {
        this.selectedFiles.push({ file, previewUrl: null });
      }
    });
  }

  // NAYA: Specific file hatane ke liye index use hoga
  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  getFileIcon(file: File): string {
    if (file.type.includes('pdf')) return 'bi-file-earmark-pdf-fill';
    if (file.type.includes('zip') || file.type.includes('rar')) return 'bi-file-earmark-zip-fill';
    if (file.type.includes('video')) return 'bi-file-earmark-play-fill';
    if (file.name.endsWith('.apk')) return 'bi-android2';
    return 'bi-file-earmark-fill'; // Default doc icon
  }

  formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // =====================================
  // SEND MESSAGE & UPLOAD (MULTI-FILE)
  // =====================================
  // =====================================
  // SEND MESSAGE & UPLOAD (MULTI-FILE)
  // =====================================
  async sendMessage() {
    if ((!this.messageText.trim() && this.selectedFiles.length === 0) || !this.roomId) return;
    
    this.isUploading = true;
    const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    
    // NAYA: TypeScript ki 'null' warning hatane ke liye isko constant mein daal diya
    const validRoomId = this.roomId; 

    try {
      // 1. Agar files hain, toh pehle saari files ek sath upload karein
      let uploadedFilesMetadata: any[] = [];
      
      if (this.selectedFiles.length > 0) {
        const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : '';
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

        // Saari files ka upload array banayein (Fast parallel upload)
        const uploadPromises = this.selectedFiles.map(async (fileObj) => {
          const formData = new FormData();
          formData.append('file', fileObj.file);
          return this.http.post('http://localhost:8080/api/files/upload', formData, { headers }).toPromise();
        });

        uploadedFilesMetadata = await Promise.all(uploadPromises);
      }

      // 2. Har uploaded file ke liye ek alag message bhejein
      if (uploadedFilesMetadata.length > 0) {
        uploadedFilesMetadata.forEach((meta: any, index: number) => {
          const messagePayload: any = {
            // Text message sirf pehli file ke sath attached jayega, baaki sirf media jayenge
            content: index === 0 ? this.messageText.trim() : '', 
            sender: { id: Number(currentUserId) },
            roomId: validRoomId,
            fileUrl: meta.url,
            fileName: meta.name,
            fileType: meta.type,
            fileSize: meta.size
          };

          if (!validRoomId.startsWith('GROUP_')) {
            messagePayload.chatRoom = { id: Number(validRoomId) };
          }
          this.chatService.sendMessage(validRoomId, messagePayload);
        });
      } else {
        // 3. Agar koi file nahi hai, sirf text message bhejein
        const messagePayload: any = {
          content: this.messageText.trim(),
          sender: { id: Number(currentUserId) },
          roomId: validRoomId,

          replyTo: this.replyToMessage ? {
             id: this.replyToMessage.id,
             senderName: this.replyToMessage.senderName || this.replyToMessage.senderUsername || 'User',
             senderId: this.replyToMessage.senderId,
             content: this.replyToMessage.content,
             fileUrl: this.replyToMessage.fileUrl,
             fileType: this.replyToMessage.fileType
          } : null
        };

        if (!validRoomId.startsWith('GROUP_')) {
          messagePayload.chatRoom = { id: Number(validRoomId) };
        }
        this.chatService.sendMessage(validRoomId, messagePayload);
      }

      // 4. Input aur array clear karein
      this.messageText = ''; 
      this.selectedFiles = [];
      this.isUploading = false;
      this.chatService.triggerCloseProfilePanel();
      this.chatService.clearReplyMessage();

    } catch (error) {
      console.error("File upload failed", error);
      alert("Failed to upload some files.");
      this.isUploading = false;
    }
  }
}