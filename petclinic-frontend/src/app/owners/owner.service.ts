import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

const EMPTY_OWNER_PAGE: OwnerPage = {content: [], totalElements: 0, totalPages: 0, number: 0, size: 10};

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

  getOwners(page = 0, size = 10, sort?: string): Observable<OwnerPage> {
    return this.http
      .get<OwnerPage>(this.entityUrl, {params: this.buildParams({page, size, sort})})
      .pipe(catchError(this.handlerError('getOwners', EMPTY_OWNER_PAGE)));
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

  searchOwners(lastName: string, page = 0, size = 10, sort?: string): Observable<OwnerPage> {
    return this.http
      .get<OwnerPage>(this.entityUrl, {params: this.buildParams({lastName, page, size, sort})})
      .pipe(catchError(this.handlerError('searchOwners', EMPTY_OWNER_PAGE)));
  }

  private buildParams(query: {lastName?: string; page: number; size: number; sort?: string}): HttpParams {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.lastName !== undefined && query.lastName !== '') {
      params = params.set('lastName', query.lastName);
    }
    if (query.sort !== undefined) {
      params = params.set('sort', query.sort);
    }
    return params;
  }
}
