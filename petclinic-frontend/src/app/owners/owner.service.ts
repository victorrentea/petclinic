import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';
import {OwnerPage, OwnerSearchRequest} from './owner-page';

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

  getOwnersPage(request: OwnerSearchRequest): Observable<OwnerPage> {
    const queryParams = new URLSearchParams();
    queryParams.set('page', String(request.page));
    queryParams.set('size', String(request.size));
    queryParams.set('sort', request.sort);
    if (request.q) {
      queryParams.set('q', request.q);
    }
    return this.http
      .get<OwnerPage>(`${this.entityUrl}?${queryParams.toString()}`)
      .pipe(catchError(this.handlerError('getOwnersPage', {
        content: [],
        number: 0,
        size: request.size,
        totalElements: 0,
        totalPages: 0
      } as OwnerPage)));
  }

  getOwners(): Observable<Owner[]> {
    return this.getOwnersPage({page: 0, size: 20, sort: 'id,asc', q: ''})
      .pipe(
        map(page => page.content),
        catchError(this.handlerError('getOwners', []))
      );
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

  searchOwners(query: string): Observable<Owner[]> {
    return this.getOwnersPage({page: 0, size: 20, sort: 'id,asc', q: query ?? ''})
      .pipe(
        map(page => page.content),
        catchError(this.handlerError('searchOwners', []))
      );
  }
}
