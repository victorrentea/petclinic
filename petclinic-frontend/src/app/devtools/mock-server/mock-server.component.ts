import {Component, OnInit} from '@angular/core';
import {MappingsPreview, WiremockService, WiremockStatus, WiremockStub} from '../wiremock.service';

/**
 * "Mock Server" developer tool. Shows the WireMock stubs generated from the Swagger examples, and
 * lets the user boot a real WireMock process (started by the backend via a shell command, on a free
 * port) so the documented examples become a live backend you can call from the browser.
 */
@Component({
  selector: 'app-mock-server',
  templateUrl: './mock-server.component.html',
  styleUrls: ['./mock-server.component.css']
})
export class MockServerComponent implements OnInit {

  preview: MappingsPreview | null = null;
  status: WiremockStatus = {running: false, port: null, url: null, command: null, stubCount: 0};

  busy = false;
  errorMessage = '';
  expanded: Record<string, boolean> = {};
  tryResults: Record<string, string> = {};

  constructor(private wiremock: WiremockService) {
  }

  ngOnInit(): void {
    this.loadPreview();
    this.refreshStatus();
  }

  loadPreview(): void {
    this.wiremock.previewStubs().subscribe({
      next: preview => this.preview = preview,
      error: err => this.errorMessage = this.describe(err)
    });
  }

  refreshStatus(): void {
    this.wiremock.status().subscribe({
      next: status => this.status = status,
      error: err => this.errorMessage = this.describe(err)
    });
  }

  start(): void {
    this.busy = true;
    this.errorMessage = '';
    this.wiremock.start().subscribe({
      next: status => {
        this.status = status;
        this.busy = false;
      },
      error: err => {
        this.errorMessage = this.describe(err);
        this.busy = false;
      }
    });
  }

  stop(): void {
    this.busy = true;
    this.tryResults = {};
    this.wiremock.stop().subscribe({
      next: status => {
        this.status = status;
        this.busy = false;
      },
      error: err => {
        this.errorMessage = this.describe(err);
        this.busy = false;
      }
    });
  }

  toggle(stub: WiremockStub): void {
    this.expanded[stub.name] = !this.expanded[stub.name];
  }

  tryOnMock(stub: WiremockStub): void {
    if (!this.status.url) {
      return;
    }
    this.tryResults[stub.name] = 'Loading…';
    this.wiremock.tryOnMock(this.status.url, stub.urlPath).subscribe({
      next: body => this.tryResults[stub.name] = JSON.stringify(body, null, 2),
      error: err => this.tryResults[stub.name] = 'Error: ' + this.describe(err)
    });
  }

  private describe(err: unknown): string {
    const e = err as { error?: { detail?: string; message?: string }; message?: string };
    return e?.error?.detail || e?.error?.message || e?.message || 'Request failed';
  }
}
