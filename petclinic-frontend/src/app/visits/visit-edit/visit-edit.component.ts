import {Component, OnInit} from '@angular/core';
import {Visit} from '../visit';
import {Pet} from '../../pets/pet';
import {Owner} from '../../owners/owner';
import {PetType} from '../../pettypes/pettype';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Vet} from '../../vets/vet';

import * as moment from 'moment';
import {OwnerService} from '../../owners/owner.service';
import {PetService} from '../../pets/pet.service';
import {VetService} from '../../vets/vet.service';

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
  vets: Vet[];
  updateSuccess = false;
  errorMessage: string;

  constructor(private visitService: VisitService,
              private petService: PetService,
              private ownerService: OwnerService,
              private vetService: VetService,
              private route: ActivatedRoute,
              private router: Router) {
    this.visit = {} as Visit;
    this.currentPet = {} as Pet;
    this.currentOwner = {} as Owner;
    this.currentPetType = {} as PetType;
    this.vets = [];
  }

  ngOnInit() {
    const visitId = this.route.snapshot.params.id;
    this.vetService.getVets().subscribe(
      vets => this.vets = vets,
      error => this.errorMessage = error as any
    );
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
    visit.id = this.visit.id;

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
