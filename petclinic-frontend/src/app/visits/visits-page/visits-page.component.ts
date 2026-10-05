import {Component, OnInit} from '@angular/core';
import {finalize} from 'rxjs/operators';
import {VisitService} from '../visit.service';
import {Visit} from '../visit';

@Component({
  selector: 'app-visits-page',
  templateUrl: './visits-page.component.html',
  styleUrls: ['./visits-page.component.css'],
})
export class VisitsPageComponent implements OnInit {
  visits: Visit[] = [];
  errorMessage: string;
  isDataReceived = false;

  constructor(private visitService: VisitService) {}

  ngOnInit(): void {
    this.visitService.getVisits()
      .pipe(finalize(() => { this.isDataReceived = true; }))
      .subscribe(
        visits => this.visits = [...visits].sort((a, b) => b.date.localeCompare(a.date)),
        error => this.errorMessage = error as any,
      );
  }
}
