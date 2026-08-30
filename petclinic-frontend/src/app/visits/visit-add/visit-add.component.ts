import {Component, OnInit} from '@angular/core';
import {Visit} from '../visit';
import {TimeSlot} from '../time-slot';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {PetService} from '../../pets/pet.service';
import {Pet} from '../../pets/pet';
import {PetType} from '../../pettypes/pettype';
import {Owner} from '../../owners/owner';
import {Vet} from '../../vets/vet';
import {VetService} from '../../vets/vet.service';

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
  vets: Vet[] = [];
  freeSlots: TimeSlot[] = [];
  selectedSlot: TimeSlot | null = null;
  slotsLoaded = false;
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
    this.vetService.getVets().subscribe(
      vets => this.vets = vets,
      error => this.errorMessage = error as any);
  }

  onVetOrDateChanged() {
    this.selectedSlot = null;
    this.visit.timeSlotId = null;
    if (!this.visit.vetId || !this.visit.date) {
      this.freeSlots = [];
      this.slotsLoaded = false;
      return;
    }
    const day = moment(this.visit.date).format('YYYY-MM-DD');
    this.visitService.getFreeSlots(this.visit.vetId, day).subscribe(
      slots => {
        this.freeSlots = slots;
        this.slotsLoaded = true;
      },
      error => this.errorMessage = error as any);
  }

  selectSlot(slot: TimeSlot) {
    this.selectedSlot = slot;
    this.visit.timeSlotId = slot.id;
  }

  slotLabel(slot: TimeSlot): string {
    return slot.startTime.substring(0, 5) + '–' + slot.endTime.substring(0, 5);
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
