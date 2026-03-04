import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { SanitizationService } from './sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;
  let domSanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SanitizationService]
    });
    service = TestBed.inject(SanitizationService);
    domSanitizer = TestBed.inject(DomSanitizer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('removeHtmlTags', () => {
    it('should remove simple HTML tags', () => {
      const input = '<p>Hello World</p>';
      const result = service.removeHtmlTags(input);
      expect(result).toBe('Hello World');
    });

    it('should remove multiple HTML tags', () => {
      const input = '<div><p>Hello</p><span>World</span></div>';
      const result = service.removeHtmlTags(input);
      expect(result).toBe('HelloWorld');
    });

    it('should remove script tags', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const result = service.removeHtmlTags(input);
      expect(result).toBe('alert("XSS")Hello');
    });

    it('should handle empty string', () => {
      const result = service.removeHtmlTags('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = service.removeHtmlTags(null);
      expect(result).toBe(null);
    });

    it('should handle string without HTML tags', () => {
      const input = 'Plain text without tags';
      const result = service.removeHtmlTags(input);
      expect(result).toBe('Plain text without tags');
    });
  });

  describe('escapeSpecialCharacters', () => {
    it('should escape less than symbol', () => {
      const input = 'a < b';
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('a &lt; b');
    });

    it('should escape greater than symbol', () => {
      const input = 'a > b';
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('a &gt; b');
    });

    it('should escape ampersand', () => {
      const input = 'Tom & Jerry';
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('Tom &amp; Jerry');
    });

    it('should escape double quotes', () => {
      const input = 'He said "Hello"';
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('He said &quot;Hello&quot;');
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('It&#x27;s a test');
    });

    it('should escape multiple special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = service.escapeSpecialCharacters(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should handle empty string', () => {
      const result = service.escapeSpecialCharacters('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = service.escapeSpecialCharacters(null);
      expect(result).toBe(null);
    });
  });

  describe('validateNoScriptTags', () => {
    it('should return true for safe text', () => {
      const input = 'This is safe feedback';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(true);
    });

    it('should return false for script tag', () => {
      const input = '<script>alert("XSS")</script>';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return false for script tag with uppercase', () => {
      const input = '<SCRIPT>alert("XSS")</SCRIPT>';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return false for iframe tag', () => {
      const input = '<iframe src="malicious.com"></iframe>';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return false for onclick event handler', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return false for onload event handler', () => {
      const input = '<img onload="alert(\'XSS\')" src="image.jpg">';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return false for onerror event handler', () => {
      const input = '<img onerror="alert(\'XSS\')" src="invalid.jpg">';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(false);
    });

    it('should return true for empty string', () => {
      const result = service.validateNoScriptTags('');
      expect(result).toBe(true);
    });

    it('should return true for null input', () => {
      const result = service.validateNoScriptTags(null);
      expect(result).toBe(true);
    });

    it('should return true for text containing word "script" but not as tag', () => {
      const input = 'I wrote a script for the movie';
      const result = service.validateNoScriptTags(input);
      expect(result).toBe(true);
    });
  });

  describe('sanitizeFeedback', () => {
    it('should sanitize normal feedback text', () => {
      const input = 'Great veterinarian!';
      const result = service.sanitizeFeedback(input);
      expect(result).toBe('Great veterinarian!');
    });

    it('should remove HTML tags and escape special characters', () => {
      const input = '<p>Great vet & very caring!</p>';
      const result = service.sanitizeFeedback(input);
      expect(result).toBe('Great vet &amp; very caring!');
    });

    it('should throw error for script tags', () => {
      const input = '<script>alert("XSS")</script>Good vet';
      expect(() => service.sanitizeFeedback(input)).toThrowError(
        'Feedback contains invalid content. Please remove any HTML or script tags'
      );
    });

    it('should throw error for iframe tags', () => {
      const input = '<iframe src="malicious.com"></iframe>Good vet';
      expect(() => service.sanitizeFeedback(input)).toThrowError(
        'Feedback contains invalid content. Please remove any HTML or script tags'
      );
    });

    it('should throw error for event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Good vet</div>';
      expect(() => service.sanitizeFeedback(input)).toThrowError(
        'Feedback contains invalid content. Please remove any HTML or script tags'
      );
    });

    it('should trim whitespace', () => {
      const input = '  Great veterinarian!  ';
      const result = service.sanitizeFeedback(input);
      expect(result).toBe('Great veterinarian!');
    });

    it('should handle empty string', () => {
      const result = service.sanitizeFeedback('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = service.sanitizeFeedback(null);
      expect(result).toBe(null);
    });

    it('should handle feedback with quotes', () => {
      const input = 'The vet said "your pet is healthy"';
      const result = service.sanitizeFeedback(input);
      expect(result).toBe('The vet said &quot;your pet is healthy&quot;');
    });
  });
});
