import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'linkify',
  standalone: true // Agar aap standalone components use kar rahi hain
})
export class LinkifyPipe implements PipeTransform {
  
  transform(value: string): string {
    if (!value) return value;

    // STEP 1: XSS Protection (HTML tags ko execute hone se rokna)
    let safeValue = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // STEP 2: Linkify Logic (Sirf URLs ko clickable banana)
    // Ye regex http:// ya https:// se shuru hone wale links ko pakadta hai
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return safeValue.replace(urlRegex, (url) => {
      // url ko <a> tag me wrap kar do, target="_blank" se link naye tab me khulega
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 500;">${url}</a>`;
    });
  }
  
}