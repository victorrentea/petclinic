import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnerSearchParams {
  name?: string;
  address?: string;
  page?: number;
  size?: number;
  sort?: string[];
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

  getOwners(params: OwnerSearchParams = {}): Observable<OwnerPage> {
    let httpParams = new HttpParams();

    const trimmedName = params.name?.trim();
    if (trimmedName) {
      httpParams = httpParams.set('name', trimmedName);
    }

    const trimmedAddress = params.address?.trim();
    if (trimmedAddress) {
      httpParams = httpParams.set('address', trimmedAddress);
    }

    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }

    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size.toString());
    }

    params.sort?.forEach((sort) => {
      httpParams = httpParams.append('sort', sort);
    });

    const emptyPage: OwnerPage = {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: params.size ?? 0
    };

    return this.http
      .get<OwnerPage>(this.entityUrl, { params: httpParams })
      .pipe(catchError(this.handlerError('getOwners', emptyPage)));
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
