import {Component, OnInit} from '@angular/core';
import {ThemePreference, ThemeService} from './theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  themePreference: ThemePreference = 'system';

  constructor(private readonly themeService: ThemeService) {
  }

  ngOnInit(): void {
    this.themeService.init();
    this.themePreference = this.themeService.getPreference();
  }

  onThemePreferenceChange(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
    this.themePreference = preference;
  }
}
