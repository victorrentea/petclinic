import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
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

  getOwners(params?: { page?: number; size?: number; sort?: string[]; q?: string }): Observable<OwnerPage> {
    const queryParts: string[] = [];
    if (params?.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
    if (params?.page !== undefined) queryParts.push(`page=${params.page}`);
    if (params?.size !== undefined) queryParts.push(`size=${params.size}`);
    params?.sort?.forEach(s => queryParts.push(`sort=${s}`));
    const url = queryParts.length ? `${this.entityUrl}?${queryParts.join('&')}` : this.entityUrl;
    return this.http
      .get<OwnerPage>(url)
      .pipe(catchError(this.handlerError('getOwners', { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 } as OwnerPage)));
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

  searchOwners(searchText: string): Observable<OwnerPage> {
    let url = this.entityUrl;
    if (searchText !== undefined) {
      url += '?q=' + searchText;
    }
    return this.http
      .get<OwnerPage>(url)
      .pipe(catchError(this.handlerError('searchOwners', {content: [], totalElements: 0, totalPages: 0, number: 0, size: 20} as OwnerPage)));
  }
}
