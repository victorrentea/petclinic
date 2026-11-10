import {Component, Input, OnInit} from '@angular/core';
import {Pet} from '../pet';
import {PetService} from '../pet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Location} from '@angular/common';
import {Owner} from '../../owners/owner';
import {PetType} from '../../pettypes/pettype';
import {PetTypeService} from '../../pettypes/pettype.service';

import * as moment from 'moment';
import {OwnerService} from '../../owners/owner.service';

@Component({
  selector: 'app-pet-edit',
  templateUrl: './pet-edit.component.html',
  styleUrls: ['./pet-edit.component.css']
})
export class PetEditComponent implements OnInit {
  pet: Pet;
  @Input() currentType: PetType;
  currentOwner: Owner;
  petTypes: PetType[];
  errorMessage: string;

  constructor(private petService: PetService,
              private petTypeService: PetTypeService,
              private ownerService: OwnerService,
              private router: Router,
              private route: ActivatedRoute,
              private location: Location) {
    this.pet = {} as Pet;
    this.currentOwner = {} as Owner;
    this.currentType = {} as PetType;
    this.petTypes = [];
  }

  ngOnInit() {

    this.petTypeService.getPetTypes().subscribe(
      pettypes => this.petTypes = pettypes,
      error => this.errorMessage = error as any);

    const petId = this.route.snapshot.params.id;
    this.petService.getPetById(petId).subscribe(
      pet => {
        this.pet = pet;
        this.ownerService.getOwnerById(pet.ownerId).subscribe(
          response => {
            this.currentOwner = response;
          });
        this.currentType = this.pet.type;
      },
      error => this.errorMessage = error as any);

  }

  sameType = (a: PetType, b: PetType) => a?.id === b?.id;

  onSubmit(pet: Pet) {
    pet.type = this.currentType;
    const that = this;
    // format output from datepicker to short string yyyy-mm-dd format (rfc3339)
    pet.birthDate = moment(pet.birthDate).format('YYYY-MM-DD');

    this.petService.updatePet(pet.id.toString(), pet).subscribe(
      res => this.gotoOwnerDetail(),
      error => this.errorMessage = error as any
    );
  }

  // back where the user came from (e.g. a page of the owners grid); to the owner when the page was opened directly
  goBack() {
    const cameFromInsideTheApp = (this.location.getState() as {navigationId?: number})?.navigationId > 1;
    if (cameFromInsideTheApp) {
      this.location.back();
    } else {
      this.gotoOwnerDetail();
    }
  }

  gotoOwnerDetail() {
    this.router.navigate(['/owners', this.currentOwner.id]);
  }

}
