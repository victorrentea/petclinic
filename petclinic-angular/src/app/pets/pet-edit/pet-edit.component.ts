import {Component, Input, OnInit} from '@angular/core';
import {Pet} from '../pet';
import {PetService} from '../pet.service';
import {ActivatedRoute, Router} from '@angular/router';
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
              private route: ActivatedRoute) {
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

  onSubmit(pet: Pet) {
    pet.type = this.currentType;
    const that = this;
    // format output from datepicker to short string yyyy-mm-dd format (rfc3339)
    pet.birthDate = moment(pet.birthDate).format('YYYY-MM-DD');

    this.petService.updatePet(pet.id.toString(), pet).subscribe(
      res => this.gotoOwnerDetail(this.currentOwner),
      error => this.errorMessage = error as any
    );
  }

  gotoOwnerDetail(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

}
