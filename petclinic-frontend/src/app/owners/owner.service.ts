import { Injectable } from '@angular/core';
import { Owner, OwnerListQuery, OwnersPage } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';
  private readonly emptyOwnersPage: OwnersPage = {
    items: [],
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    lastName: '',
    sort: {
      field: 'name',
      direction: 'asc'
    }
  };

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getOwnersPage(query: OwnerListQuery = {}): Observable<OwnersPage> {
    let params = new HttpParams();

    if (query.lastName !== undefined) {
      params = params.set('lastName', query.lastName);
    }
    if (query.page !== undefined) {
      params = params.set('page', query.page.toString());
    }
    if (query.pageSize !== undefined) {
      params = params.set('pageSize', query.pageSize.toString());
    }
    if (query.sort !== undefined) {
      params = params.set('sort', query.sort);
    }
    if (query.direction !== undefined) {
      params = params.set('direction', query.direction);
    }

    return this.http
      .get<OwnersPage>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('getOwnersPage', this.emptyOwnersPage)));
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
