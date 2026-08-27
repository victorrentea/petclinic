import {Component, OnInit} from '@angular/core';
import {Visit} from '../visit';
import {Pet} from '../../pets/pet';
import {Owner} from '../../owners/owner';
import {PetType} from '../../pettypes/pettype';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';

import * as moment from 'moment';
import {OwnerService} from '../../owners/owner.service';
import {PetService} from '../../pets/pet.service';

@Component({
  selector: 'app-visit-edit',
  templateUrl: './visit-edit.component.html',
  styleUrls: ['./visit-edit.component.css']
})
export class VisitEditComponent implements OnInit {
  visit: Visit;
  currentPet: Pet;
  currentOwner: Owner;
  currentPetType: PetType;
  // GitHub #40: a visit can neither predate its pet nor be booked more than a year ahead.
  // Moment objects, because MatMomentDateModule is what this module installs as the adapter.
  minVisitDate?: moment.Moment;
  readonly maxVisitDate = moment().add(1, 'year');
  readonly maxVisitDateLabel = moment().add(1, 'year').format('YYYY/MM/DD');
  updateSuccess = false;
  errorMessage: string;

  constructor(private visitService: VisitService,
              private petService: PetService,
              private ownerService: OwnerService,
              private route: ActivatedRoute,
              private router: Router) {
    this.visit = {} as Visit;
    this.currentPet = {} as Pet;
    this.currentOwner = {} as Owner;
    this.currentPetType = {} as PetType;
  }

  ngOnInit() {
    const visitId = this.route.snapshot.params.id;
    this.visitService.getVisitById(visitId).subscribe(
      visit => {
        this.visit = visit;
        this.petService.getPetById(visit.petId).subscribe(
          pet => {
            this.currentPet = pet;
            this.currentPetType = pet.type;
            this.minVisitDate = pet.birthDate ? moment(pet.birthDate) : undefined;
            this.ownerService.getOwnerById(pet.ownerId).subscribe(
              owner => {
                this.currentOwner = owner;
              }
            )
          }
        )
      },
      error => this.errorMessage = error as any);
  }

  onSubmit(visit: Visit) {
    visit.pet = this.currentPet;

    // format output from datepicker to short string yyyy-mm-dd format (rfc3339)
    visit.date = moment(visit.date).format('YYYY-MM-DD');

    this.visitService.updateVisit(visit.id.toString(), visit).subscribe(
      res => this.gotoOwnerDetail(),
      error => this.errorMessage = error as any);

  }

  gotoOwnerDetail() {
    this.router.navigate(['/owners', this.currentOwner.id]);
  }

}
