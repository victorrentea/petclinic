import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Service for sanitizing user input to prevent XSS attacks.
 * Provides defense-in-depth; backend OWASP sanitizer is primary protection.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
@Injectable({
  providedIn: 'root'
})
export class SanitizationService {

  constructor(private domSanitizer: DomSanitizer) { }

  /**
   * Sanitizes feedback text by removing HTML tags, escaping special characters,
   * and validating no script tags are present.
   * 
   * @param input - The feedback text to sanitize
   * @returns Sanitized feedback text
   * @throws Error if input contains script tags or event handlers
   */
  sanitizeFeedback(input: string): string {
    if (!input) {
      return input;
    }

    // First validate no script tags
    if (!this.validateNoScriptTags(input)) {
      throw new Error('Feedback contains invalid content. Please remove any HTML or script tags');
    }

    // Remove HTML tags
    let sanitized = this.removeHtmlTags(input);

    // Escape special characters
    sanitized = this.escapeSpecialCharacters(sanitized);

    return sanitized.trim();
  }

  /**
   * Removes all HTML tags from the input string using regex.
   * 
   * @param input - The string to remove HTML tags from
   * @returns String with all HTML tags removed
   */
  removeHtmlTags(input: string): string {
    if (!input) {
      return input;
    }

    // Remove all HTML tags using regex
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Escapes special characters that could be interpreted as code.
   * Escapes: <, >, &, ", '
   * 
   * @param input - The string to escape
   * @returns String with special characters escaped
   */
  escapeSpecialCharacters(input: string): string {
    if (!input) {
      return input;
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Validates that the input does not contain script tags, iframe tags,
   * or event handlers like onclick.
   * 
   * @param input - The string to validate
   * @returns true if input is safe, false if it contains malicious content
   */
  validateNoScriptTags(input: string): boolean {
    if (!input) {
      return true;
    }

    const lowerInput = input.toLowerCase();

    // Check for script tags
    if (lowerInput.includes('<script') || lowerInput.includes('</script>')) {
      return false;
    }

    // Check for iframe tags
    if (lowerInput.includes('<iframe') || lowerInput.includes('</iframe>')) {
      return false;
    }

    // Check for common event handlers
    const eventHandlers = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown',
      'onkeyup', 'onkeypress'
    ];

    for (const handler of eventHandlers) {
      if (lowerInput.includes(handler + '=')) {
        return false;
      }
    }

    return true;
  }
}
