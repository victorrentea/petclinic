import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LinkifySnackbarComponent } from './shared/linkify-snackbar/linkify-snackbar.component';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private snackBar: MatSnackBar) {}

  private static readonly BACKEND_URL = 'http://localhost:8080';

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Backend unreachable: connection refused / network error.
        // status === 0 covers it; error.error is a browser ProgressEvent/ErrorEvent
        // here, which would otherwise serialize to the useless {"isTrusted":true}.
        if (this.isBackendDown(error)) {
          const url = HttpErrorInterceptor.BACKEND_URL;
          const message =
            `Backend is unreachable — the API server at ${url} appears to be down. ` +
            `Open ${url} to view the backend's Swagger UI.`;
          console.error(error);
          this.snackBar.openFromComponent(LinkifySnackbarComponent, {
            data: { message },
            duration: 10000,
          });
          return throwError(() => error);
        }

        // Derive a user-friendly message from the response
        let message = '';

        if (error.error instanceof ErrorEvent) {
          // A client-side or network error occurred.
          message = error.error.message || 'An unknown error occurred.';
        } else {
          // Server-side error
          // Prefer explicit error messages from the body
          if (error.error) {
            if (typeof error.error === 'string') {
              message = error.error;
            } else if (error.error.message) {
              message = error.error.message;
            } else if (error.error.errorMessage) {
              message = error.error.errorMessage;
            } else {
              // Try to stringify the body as a fallback
              try {
                message = JSON.stringify(error.error);
              } catch (e) {
                message = `server returned code ${error.status}`;
              }
            }
          } else {
            message = `server returned code ${error.status}`;
          }

          // Check for Spring-style errors header
          const errorsHeader = error.headers?.get?.('errors');
          if (errorsHeader) {
            try {
              const errors = JSON.parse(errorsHeader);
              if (Array.isArray(errors) && errors.length > 0 && errors[0].errorMessage) {
                message = errors[0].errorMessage;
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        }

        // Always log to console for debugging
        console.error(error);

        // Show toast with the message (use a short default message if empty)
        const toast = message || 'Request failed';
        this.snackBar.openFromComponent(LinkifySnackbarComponent, {
          data: { message: toast, action: 'Close' },
          duration: 5000,
        });

        // Re-throw the error so callers can still handle it if they want
        return throwError(() => error);
      })
    );
  }

  private isBackendDown(error: HttpErrorResponse): boolean {
    if (error.status === 0) {
      return true;
    }
    const cause = error.error;
    const isProgressEvent =
      typeof ProgressEvent !== 'undefined' && cause instanceof ProgressEvent;
    return cause instanceof ErrorEvent || isProgressEvent;
  }
}
