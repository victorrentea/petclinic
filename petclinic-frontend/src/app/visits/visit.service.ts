import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {Visit} from './visit';
import {TimeSlot} from './time-slot';
import {environment} from '../../environments/environment';
import {HandleError, HttpErrorHandler} from '../error.service';
import {HttpClient} from '@angular/common/http';
import {catchError} from 'rxjs/operators';

@Injectable()
export class VisitService {

  private entityUrl = environment.REST_API_URL + 'visits';

  private readonly handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getVisits(): Observable<Visit[]> {
    return this.http.get<Visit[]>(this.entityUrl)
      .pipe(
        catchError(this.handlerError('getVisits', []))
      );
  }

  getVisitById(visitId: string): Observable<Visit> {
    return this.http.get<Visit>(this.entityUrl + '/' + visitId)
      .pipe(
        catchError(this.handlerError('getVisitById', {} as Visit))
      );
  }

  getFreeSlots(vetId: number, date: string): Observable<TimeSlot[]> {
    const slotsUrl = environment.REST_API_URL + `vets/${vetId}/slots`;
    return this.http.get<TimeSlot[]>(slotsUrl, {params: {date}})
      .pipe(
        catchError(this.handlerError('getFreeSlots', []))
      );
  }

  addVisit(visit: Visit): Observable<Visit> {
    return this.http.post<Visit>(this.entityUrl, {...visit, petId: visit.pet.id})
      .pipe(
        catchError(this.handlerError('addVisit', visit))
      );
  }

  updateVisit(visitId: string, visit: Visit): Observable<Visit> {
    return this.http.put<Visit>(this.entityUrl + '/' + visitId, visit)
      .pipe(
        catchError(this.handlerError('updateVisit', visit))
      );
  }

  deleteVisit(visitId: string): Observable<number> {
    return this.http.delete<number>(this.entityUrl + '/' + visitId)
      .pipe(
        catchError(this.handlerError('deleteVisit', 0))
      );

  }


}
