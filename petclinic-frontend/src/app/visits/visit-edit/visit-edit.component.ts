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

  /**
   * The bounds the datepicker enforces, and the same rule the backend applies
   * (VisitDateRange): a visit cannot predate the pet, nor sit more than a year out.
   * GitHub issue #40.
   *
   * `currentPet` starts empty and is filled asynchronously, so `minVisitDate` is
   * undefined on the first render — which the datepicker reads as "no lower bound"
   * until the pet arrives. The backend is what makes the rule binding; this only
   * spares the user a round-trip.
   */
  get minVisitDate(): Date | undefined {
    return this.currentPet?.birthDate ? new Date(this.currentPet.birthDate) : undefined;
  }

  get maxVisitDate(): Date {
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    return max;
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
