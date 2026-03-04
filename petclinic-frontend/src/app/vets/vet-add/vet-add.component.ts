import {Component, OnInit} from '@angular/core';
import {Specialty} from '../../specialties/specialty';
import {SpecialtyService} from 'app/specialties/specialty.service';
import {Vet} from '../vet';
import {Router} from '@angular/router';
import {VetService} from '../vet.service';

@Component({
  selector: 'app-vet-add',
  templateUrl: './vet-add.component.html',
  styleUrls: ['./vet-add.component.css']
})
export class VetAddComponent implements OnInit {
  vet: Vet;
  specialtiesList: Specialty[];
  selectedSpecialty: Specialty;
  errorMessage: string;

  constructor(private specialtyService: SpecialtyService, private vetService: VetService, private router: Router) {
    this.vet = {} as Vet;
    this.selectedSpecialty = {} as Specialty;
    this.specialtiesList = [];
  }

  ngOnInit() {
    this.specialtyService.getSpecialties().subscribe(
      specialties => this.specialtiesList = specialties,
      error => this.errorMessage = error as any
    );
  }

  onSubmit(vet: Vet) {
    vet.id = null;
    vet.specialties = [];
    if (this.selectedSpecialty.id !== undefined) {
      vet.specialties.push(this.selectedSpecialty);
    }
    this.vetService.addVet(vet).subscribe(
      newVet => {
        this.vet = newVet;
        this.gotoVetList();
      },
      error => this.errorMessage = error as any
    );
  }

  gotoVetList() {
    this.router.navigate(['/vets']);
  }
}
