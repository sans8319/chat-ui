import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-poll-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './poll-window.html',
  styleUrl: './poll-window.scss'
})
export class PollWindowComponent {
  pollQuestion: string = '';
  pollDescription: string = '';
  
  // Default 3 options jaisa image me hai
  pollOptions: string[] = ['', '', ''];

  // Default selections
  selectedType: 'single' | 'multiple' = 'single';
  selectedAudience: 'all' | 'department' | 'specific' = 'all';
  selectedVisibility: 'anonymous' | 'public' = 'anonymous';

  addOption() {
    this.pollOptions.push('');
  }

  removeOption(index: number) {
    if (this.pollOptions.length > 2) {
      this.pollOptions.splice(index, 1);
    } else {
      alert("A poll must have at least 2 options.");
    }
  }

  // Custom trackBy to prevent input losing focus on type
  trackByIndex(index: number, obj: any): any {
    return index;
  }
}