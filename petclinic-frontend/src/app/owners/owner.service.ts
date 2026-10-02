import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import { OwnerPage, OwnerPageQuery } from './owner-page';

// Angular's default codec leaves '+' unencoded, which the server then reads as a space
const strictCodec: HttpParameterCodec = {
  encodeKey: encodeURIComponent,
  encodeValue: encodeURIComponent,
  decodeKey: decodeURIComponent,
  decodeValue: decodeURIComponent,
};

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

  getOwners(query: OwnerPageQuery = {}): Observable<OwnerPage> {
    let params = new HttpParams({ encoder: strictCodec });
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params = params.set(name, value);
      }
    }
    return this.http
      .get<OwnerPage>(this.entityUrl, { params })
      .pipe(
        catchError(this.handlerError<OwnerPage>('getOwners')),
        map(requirePage));
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

// An array means a backend from before paging (#25): fail loudly rather than show nothing
function requirePage(body: OwnerPage): OwnerPage {
  if (!Array.isArray(body?.content) || typeof body.totalElements !== 'number') {
    throw new TypeError('The owners list did not answer with a page');
  }
  return body;
}
