import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class SignupComponent {
  signupData = { username: '', email: '', password: '' };
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  
  // 🛑 NAYA: Password show/hide track karne ke liye
  showPassword = false;

  constructor(private http: HttpClient, private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSignup() {
    
    this.errorMessage = ''; // Pehle error clear karein
    this.successMessage = '';

    if (!this.signupData.username.trim() || !this.signupData.email.trim() || !this.signupData.password.trim()) {
      this.errorMessage = 'Please fill in all fields.';
      return; 
    }

    // 🛑 NAYA: 2. Username Validation (Kam se kam ek alphabet hona zaroori hai)
    const hasAlphabets = /[a-zA-Z]/.test(this.signupData.username);
    if (!hasAlphabets) {
      this.errorMessage = 'Username must contain at least one letter.';
      return;
    }

    // 🛑 NAYA: Email Format Validation (Regex)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(this.signupData.email)) {
      this.errorMessage = 'Please enter a valid email address.';
      return; // Agar email galat hai, toh form aage nahi badhega
    }

    if (this.signupData.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      return;
    }

    this.isLoading = true;
    this.http.post('http://localhost:8080/auth/signup', this.signupData).subscribe({
      next: (res: any) => {
        this.successMessage = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/']), 2000);
      },
      error: (err) => {
        console.error('Signup failed', err);
        this.errorMessage = 'Signup failed. Username/Email might be taken.'; // Backend error yahan dikhega
        this.isLoading = false;
      }
    });
  }
}