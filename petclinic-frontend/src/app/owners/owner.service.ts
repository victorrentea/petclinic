import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import { DEFAULT_OWNER_PAGE_QUERY, OwnerPage, OwnerPageQuery } from './owner-page';

// A backend still answering with the old bare array must surface as an error, not as an empty grid
function requireOwnerPage(response: OwnerPage): OwnerPage {
  if (!Array.isArray(response?.content) || typeof response.totalElements !== 'number') {
    throw new Error('Unexpected owner list response: expected {content, totalElements}');
  }
  return response;
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

  getOwnerPage(query: Partial<OwnerPageQuery> = {}): Observable<OwnerPage> {
    const {lastName, page, size, sort} = {...DEFAULT_OWNER_PAGE_QUERY, ...query};
    let params = new HttpParams();
    if (lastName) {
      params = params.set('lastName', lastName);
    }
    params = params.set('page', page).set('size', size).set('sort', sort);
    return this.http
      .get<OwnerPage>(this.entityUrl, {params})
      .pipe(
        catchError(this.handlerError<OwnerPage>('getOwnerPage')),
        map(requireOwnerPage));
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
