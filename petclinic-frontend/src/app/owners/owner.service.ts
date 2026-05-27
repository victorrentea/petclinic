import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnersPage {
  content: Owner[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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

  listOwners(params: {
    lastName?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<OwnersPage> {
    let httpParams = new HttpParams();
    if (params.lastName) {
      httpParams = httpParams.set('lastName', params.lastName);
    }
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.size !== undefined && params.size !== null) {
      httpParams = httpParams.set('size', String(params.size));
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    return this.http.get<OwnersPage>(this.entityUrl, { params: httpParams });
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
