import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface PagedResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

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
  private readonly defaultPageSize = 10;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getOwners(searchParams: OwnerSearchParams = {}): Observable<PagedResponse<Owner>> {
    const trimmedName = searchParams.name?.trim();
    const trimmedAddress = searchParams.address?.trim();
    const page = searchParams.page ?? 0;
    const size = searchParams.size ?? this.defaultPageSize;
    const sortEntries = searchParams.sort ?? [];
    let params = new HttpParams();

    if (trimmedName) {
      params = params.set('name', trimmedName);
    }
    if (trimmedAddress) {
      params = params.set('address', trimmedAddress);
    }

    params = params.set('page', page.toString());
    params = params.set('size', size.toString());

    sortEntries.forEach((sortEntry) => {
      params = params.append('sort', sortEntry);
    });

    return this.http
      .get<PagedResponse<Owner>>(this.entityUrl, { params })
      .pipe(catchError(this.handlerError('getOwners', this.emptyPage(size))));
  }

  private emptyPage(size: number): PagedResponse<Owner> {
    return {
      content: [],
      number: 0,
      size,
      totalElements: 0,
      totalPages: 0
    };
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
