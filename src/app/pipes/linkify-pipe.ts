import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true
})
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return value;

    // URL detect karne ka Regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Text ke andar ki links ko clickable <a> tags mein badalna
    const replacedText = value.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 500;">${url}</a>`;
    });

    // Angular ko batana ki yeh HTML browser mein render hona safe hai
    return this.sanitizer.bypassSecurityTrustHtml(replacedText);
  }
}