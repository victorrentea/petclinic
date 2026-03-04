import {Component, OnInit} from '@angular/core';
import {Specialty} from '../specialty';
import {SpecialtyService} from '../specialty.service';
import {Router} from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-specialty-list',
  templateUrl: './specialty-list.component.html',
  styleUrls: ['./specialty-list.component.css']
})
export class SpecialtyListComponent implements OnInit {
  specialties: Specialty[];
  errorMessage: string;
  responseStatus: number;
  isInsert = false;
  isSpecialitiesDataReceived: boolean = false;

  constructor(private specService: SpecialtyService, private router: Router) {
    this.specialties = [];
  }

  ngOnInit() {
    this.specService.getSpecialties().pipe(
      finalize(() => {
        this.isSpecialitiesDataReceived = true;
      })
    ).subscribe(
      specialties => this.specialties = specialties,
      error => this.errorMessage = error as any);
  }

  deleteSpecialty(specialty: Specialty) {
    this.specService.deleteSpecialty(specialty.id.toString()).subscribe(
      response => {
        this.responseStatus = response;
        this.specialties = this.specialties.filter(currentItem => !(currentItem.id === specialty.id));
      },
      error => this.errorMessage = error as any);
  }

  onNewSpecialty(newSpecialty: Specialty) {
    this.specialties.push(newSpecialty);
    this.showAddSpecialtyComponent();
  }

  showAddSpecialtyComponent() {
    this.isInsert = !this.isInsert;
  }

  showEditSpecialtyComponent(updatedSpecialty: Specialty) {
    this.router.navigate(['/specialties', updatedSpecialty.id.toString(), 'edit']);
  }

  gotoHome() {
    this.router.navigate(['/welcome']);
  }

}
