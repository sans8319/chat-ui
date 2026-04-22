import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  constructor(private http: HttpClient, private router: Router) {}

  onLogin() {
    this.isLoading = true;
    this.http.post('http://localhost:8080/auth/login', this.loginData).subscribe({
      next: (res: any) => {
        // Token aur User info save karna
        localStorage.setItem('token', res.token);
        localStorage.setItem('username', this.loginData.username);
        localStorage.setItem('userId', res.id);
        this.router.navigate(['/chat']);
      },
      error: (err) => {
        this.errorMessage = 'Invalid credentials. Please try again.';
        this.isLoading = false;
      }
    });
  }
}