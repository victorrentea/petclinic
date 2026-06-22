import {Component, Inject} from '@angular/core';
import {MAT_SNACK_BAR_DATA, MatSnackBarRef} from '@angular/material/snack-bar';

export interface LinkifySnackbarData {
  message: string;
  action?: string;
}

interface Segment {
  text: string;
  isUrl: boolean;
}

@Component({
  selector: 'app-linkify-snackbar',
  templateUrl: './linkify-snackbar.component.html',
  styleUrls: ['./linkify-snackbar.component.css']
})
export class LinkifySnackbarComponent {

  private static readonly URL_REGEX = /(https?:\/\/[^\s]+)/g;

  readonly segments: Segment[];
  readonly action: string;

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: LinkifySnackbarData,
    private snackBarRef: MatSnackBarRef<LinkifySnackbarComponent>
  ) {
    this.segments = this.splitIntoSegments(data.message);
    this.action = data.action || 'Close';
  }

  dismiss(): void {
    this.snackBarRef.dismiss();
  }

  private splitIntoSegments(message: string): Segment[] {
    const parts = message.split(LinkifySnackbarComponent.URL_REGEX);
    return parts
      .filter(part => part.length > 0)
      .map(part => ({text: part, isUrl: LinkifySnackbarComponent.isUrl(part)}));
  }

  private static isUrl(part: string): boolean {
    return /^https?:\/\//.test(part);
  }
}
