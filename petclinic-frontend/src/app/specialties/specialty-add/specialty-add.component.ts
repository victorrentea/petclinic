import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { Specialty } from '../specialty';
import { SpecialtyService } from '../specialty.service';

@Component({
  selector: 'app-specialty-add',
  templateUrl: './specialty-add.component.html',
  styleUrls: ['./specialty-add.component.css'],
})
export class SpecialtyAddComponent implements OnInit {
  @ViewChild('specialityForm', { static: true }) specialityForm: NgForm;
  speciality: Specialty;
  addedSuccess = false;
  errorMessage: string;
  @Output() newSpeciality = new EventEmitter<Specialty>();

  constructor(private specialtyService: SpecialtyService) {
    this.speciality = {} as Specialty;
  }

  ngOnInit() {}

  onSubmit(specialty: Specialty) {
    this.specialtyService.addSpecialty(specialty).subscribe(
      (newSpecialty) => {
        this.speciality = newSpecialty;
        this.addedSuccess = true;
        this.newSpeciality.emit(this.speciality);
      },
      (error) => (this.errorMessage = error as any)
    );
  }
}
