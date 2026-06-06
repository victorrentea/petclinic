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
import {Vet} from '../../vets/vet';
import {VetService} from '../../vets/vet.service';

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
  vets: Vet[] = [];
  pets: Pet[] = [];
  needsPetSelection = false;
  addedSuccess = false;
  errorMessage: string;

  constructor(private visitService: VisitService,
              private petService: PetService,
              private ownerService: OwnerService,
              private vetService: VetService,
              private router: Router,
              private route: ActivatedRoute) {
    this.visit = {} as Visit;
    this.currentPet = {} as Pet;
    this.currentOwner = {} as Owner;
    this.currentPetType = {} as PetType;

  }

  ngOnInit() {
    this.vetService.getVets().subscribe(
      vets => this.vets = vets,
      error => this.errorMessage = error as any);
    const petId = this.route.snapshot.params.id;
    if (petId) {
      this.petService.getPetById(petId).subscribe(
        pet => this.adoptPet(pet),
        error => this.errorMessage = error as any);
    } else {
      // Reached via the bare /visits/add route: the pet must be picked in the form.
      this.needsPetSelection = true;
      this.petService.getPets().subscribe(
        pets => this.pets = pets,
        error => this.errorMessage = error as any);
    }
  }

  onPetSelected(petId: number) {
    const pet = this.pets.find(p => p.id === petId);
    if (pet) {
      this.adoptPet(pet);
    }
  }

  private adoptPet(pet: Pet) {
    this.currentPet = pet;
    this.visit.pet = pet;
    this.currentPetType = pet.type;
    this.ownerService.getOwnerById(pet.ownerId).subscribe(
      owner => this.currentOwner = owner,
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
