import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {HttpErrorHandler} from './error.service';

describe('HttpErrorHandler', () => {
  const handler = new HttpErrorHandler();

  function messageFor(error: HttpErrorResponse): string {
    let message: string;
    handler.handleError('VisitService', 'addVisit')(error).subscribe({error: e => message = e});
    return message;
  }

  it('reads the errors of a ProblemDetail body', () => {
    const refusal = 'Visit date 2020-02-29 is before Dapple\'s birth date 2020-03-01';
    const problem = {title: 'Validation Error', errors: [refusal]};

    expect(messageFor(new HttpErrorResponse({status: 400, error: problem}))).toBe(refusal);
  });

  it('falls back to the status and body for anything else', () => {
    expect(messageFor(new HttpErrorResponse({status: 500, error: 'boom', headers: new HttpHeaders()})))
      .toBe('server returned code 500 with body "boom"');
  });
});
