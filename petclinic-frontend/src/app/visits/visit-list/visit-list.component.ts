import {Component, Input, OnInit} from '@angular/core';
import {Visit} from '../visit';
import {VisitService} from '../visit.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-visit-list',
  templateUrl: './visit-list.component.html',
  styleUrls: ['./visit-list.component.css']
})
export class VisitListComponent implements OnInit {

  @Input() petId: number;

  private _visits: Visit[];
  responseStatus: number;
  noVisits = false;
  errorMessage: string;

  constructor(private router: Router, private visitService: VisitService) {
    this._visits = [];
  }

  @Input()
  set visits(visits: Visit[]) {
    this._visits = (visits || []).map(visit => ({
      ...visit,
      vetName: visit.vetName || 'Unassigned'
    }));
    this.noVisits = this._visits.length === 0;
  }

  get visits(): Visit[] {
    return this._visits;
  }

  ngOnInit() {
  }

  addVisit() {
    this.router.navigate(['/pets', this.petId, 'visits', 'add']);
  }

  editVisit(visit: Visit) {
    this.router.navigate(['/visits', visit.id, 'edit']);
  }

  deleteVisit(visit: Visit) {
    this.visitService.deleteVisit(visit.id.toString()).subscribe(
      response => {
        this.responseStatus = response;
        this._visits.splice(this._visits.indexOf(visit), 1 );
        if (this.visits.length === 0) {
            this.noVisits = true;
          }
      },
      error => this.errorMessage = error as any);
  }

}
