import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    // Change detection ko optimize kiya gaya hai
    provideZoneChangeDetection({ eventCoalescing: true }),
    // ViewTransitions se page switch hote waqt white flash nahi aayega
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    // withFetch() modern browser support aur speed ke liye hai
    provideHttpClient(withFetch()), 
    provideClientHydration(withEventReplay())
  ]
};