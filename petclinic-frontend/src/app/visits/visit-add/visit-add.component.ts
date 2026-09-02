import {Component, OnInit} from '@angular/core';
import {Visit} from '../visit';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {PetService} from '../../pets/pet.service';
import {Pet} from '../../pets/pet';
import {PetType} from '../../pettypes/pettype';
import {Owner} from '../../owners/owner';

import * as moment from 'moment';
import {OwnerService} from '../../owners/owner.service';

@Component({
  selector: 'app-visit-add',
  templateUrl: './visit-add.component.html',
  styleUrls: ['./visit-add.component.css']
})
export class VisitAddComponent implements OnInit {

  visit: Visit;
  currentPet: Pet;
  currentOwner: Owner;
  currentPetType: PetType;
  addedSuccess = false;
  errorMessage: string;

  constructor(private visitService: VisitService,
              private petService: PetService,
              private ownerService: OwnerService,
              private router: Router,
              private route: ActivatedRoute) {
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
    console.log(this.route.parent);
    const petId = this.route.snapshot.params.id;
    this.petService.getPetById(petId).subscribe(
      pet => {
        this.currentPet = pet;
        this.visit.pet = this.currentPet;
        this.currentPetType = this.currentPet.type;
        this.ownerService.getOwnerById(pet.ownerId).subscribe(
          owner => {
            this.currentOwner = owner;
          }
        )
      },
      error => this.errorMessage = error as any);
  }

  onSubmit(visit: Visit) {
    visit.id = null;
    const that = this;

    // format output from datepicker to short string yyyy-mm-dd format (rfc3339)
    visit.date = moment(visit.date).format('YYYY-MM-DD');

    this.visitService.addVisit(visit).subscribe(
      newVisit => {
        this.visit = newVisit;
        this.addedSuccess = true;
        that.gotoOwnerDetail();
      },
      error => this.errorMessage = error as any
    );
  }

  gotoOwnerDetail() {
    this.router.navigate(['/owners', this.currentOwner.id]);
  }

}
