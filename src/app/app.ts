import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // <-- Ye add karna hai
  templateUrl: './app.html', // Aapke file ka naam app.html hai
  styleUrl: './app.scss'     // Aapke file ka naam app.scss hai
})
export class App {
  title = 'chat-ui';
}