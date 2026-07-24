import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage, OwnerQuery } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

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

  /**
   * One server-side page of owners. Paging, sorting and the lastName filter compose into a single
   * request, so this one call covers both the plain list and the search — the browser never holds
   * more than one page (~10,000 owners are planned).
   */
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', `${query.sort},${query.direction}`);
    if (query.lastName) {
      params = params.set('lastName', query.lastName);
    }
    // Errors are deliberately NOT swallowed into an empty page here: an empty page is
    // indistinguishable from a genuine "no owners match" result, so a 500 would render as the
    // benign no-owners message. The component catches the error and shows it as a failure instead.
    return this.http.get<OwnerPage>(this.entityUrl, {params});
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
