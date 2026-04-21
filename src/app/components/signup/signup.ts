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

  constructor(private http: HttpClient, private router: Router) {}

  onSignup() {
    this.isLoading = true;
    this.http.post('http://localhost:8080/auth/signup', this.signupData).subscribe({
      next: (res: any) => {
        this.successMessage = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/']), 2000);
      },
      error: (err) => {
        console.error('Signup failed', err);
        this.isLoading = false;
      }
    });
  }
}