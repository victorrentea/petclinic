import {Component, Input, OnInit} from '@angular/core';
import {Pet} from '../pet';
import {PetType} from '../../pettypes/pettype';
import {Owner} from '../../owners/owner';
import {ActivatedRoute, Router} from '@angular/router';
import {PetTypeService} from '../../pettypes/pettype.service';
import {PetService} from '../pet.service';
import {OwnerService} from '../../owners/owner.service';

import * as moment from 'moment';

@Component({
  selector: 'app-pet-add',
  templateUrl: './pet-add.component.html',
  styleUrls: ['./pet-add.component.css']
})
export class PetAddComponent implements OnInit {
  pet: Pet;
  @Input() currentType: PetType;
  currentOwner: Owner;
  petTypes: PetType[];
  addedSuccess = false;
  errorMessage: string;

  constructor(private ownerService: OwnerService, private petService: PetService,
              private petTypeService: PetTypeService, private router: Router, private route: ActivatedRoute) {
    this.pet = {} as Pet;
    this.currentOwner = {} as Owner;
    this.currentType = {} as PetType;
    this.petTypes = [];
  }

  ngOnInit() {
    this.petTypeService.getPetTypes().subscribe(
      pettypes => this.petTypes = pettypes,
      error => this.errorMessage = error as any);

    const ownerId = this.route.snapshot.params.id;
    this.ownerService.getOwnerById(ownerId).subscribe(
      response => {
        this.currentOwner = response;
      },
      error => this.errorMessage = error as any);
  }

  onSubmit(pet: Pet) {
    pet.id = null;
    pet.owner = this.currentOwner;
    // format output from datepicker to short string yyyy-mm-dd format (rfc3339)
    pet.birthDate = moment(pet.birthDate).format('YYYY-MM-DD');
    this.petService.addPet(pet).subscribe(
      newPet => {
        this.pet = newPet;
        this.addedSuccess = true;
        this.gotoOwnerDetail();
      },
      error => this.errorMessage = error as any);
  }

  gotoOwnerDetail() {
    this.router.navigate(['/owners', this.currentOwner.id]);
  }

}
