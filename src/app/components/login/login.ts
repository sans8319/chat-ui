import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { API_CONFIG } from '../../config/api-config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  loginData = { username: '', password: '' };
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  constructor(private http: HttpClient, private router: Router) {}

  onLogin() {
    this.isLoading = true;
    this.http.post(`${API_CONFIG.BASE_URL}/auth/login`, this.loginData).subscribe({
      next: (res: any) => {
        // Token aur User info save karna
        localStorage.setItem('token', res.token);
        localStorage.setItem('username', this.loginData.username);
        localStorage.setItem('userId', res.id);
        window.location.href = '/chat';
      },
      error: (err) => {
        this.errorMessage = 'Invalid credentials. Please try again.';
        this.isLoading = false;
      }
    });
  }
}