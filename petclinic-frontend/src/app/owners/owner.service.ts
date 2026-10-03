import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import { OwnerPage, OwnerPageQuery } from './owner-page';

/** Angular's default codec leaves '+' raw, which the server decodes as a space: "A+B" would search "A B". */
class StrictQueryEncoder implements HttpParameterCodec {
  encodeKey = (key: string) => encodeURIComponent(key);
  encodeValue = (value: string) => encodeURIComponent(value).replace(/%2C/g, ',');
  decodeKey = (key: string) => decodeURIComponent(key);
  decodeValue = (value: string) => decodeURIComponent(value);
}

@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  /** Omitted query fields fall back to the server defaults: page 0 of 10, sorted by name ascending. */
  getOwnerPage(query: OwnerPageQuery = {}): Observable<OwnerPage> {
    let params = new HttpParams({encoder: new StrictQueryEncoder()});
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params = params.set(name, value);
      }
    }
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(catchError(this.handlerError<OwnerPage>('getOwnerPage')));
  }

  getOwnerById(ownerId: number): Observable<Owner> {
    return this.http
      .get<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('getOwnerById', {} as Owner)));
  }

  addOwner(owner: Owner): Observable<Owner> {
    return this.http
      .post<Owner>(this.entityUrl, owner)
      .pipe(catchError(this.handlerError('addOwner', owner)));
  }


  updateOwner(ownerId: string, owner: Owner): Observable<{}> {
    return this.http
      .put<Owner>(this.entityUrl + '/' + ownerId, owner)
      .pipe(catchError(this.handlerError('updateOwner', owner)));
  }

  deleteOwner(ownerId: string): Observable<{}> {
    return this.http
      .delete<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('deleteOwner', [ownerId])));
  }
}
