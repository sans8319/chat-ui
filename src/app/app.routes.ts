import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { ChatWindowComponent } from './components/chat-window/chat-window'; 
import { SignupComponent } from './components/signup/signup';
// Note: Agar aapke components ka path alag hai, toh upar wale imports adjust kar lena.

// src/app/app.routes.ts
export const routes: Routes = [
  { path: 'login', component: LoginComponent }, // Name change to 'login'
  { path: 'signup', component: SignupComponent },
  { path: 'chat', component: ChatWindowComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }, // Redirect logic
  { path: '**', redirectTo: 'login' }
];