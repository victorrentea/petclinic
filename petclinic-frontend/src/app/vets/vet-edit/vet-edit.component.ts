import {Component, OnInit} from '@angular/core';
import {Vet} from '../vet';
import {VetService} from '../vet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {SpecialtyService} from '../../specialties/specialty.service';
import {Specialty} from '../../specialties/specialty';
import {FormBuilder, FormGroup, FormControl, Validators} from '@angular/forms';

@Component({
  selector: 'app-vet-edit',
  templateUrl: './vet-edit.component.html',
  styleUrls: ['./vet-edit.component.css']
})
export class VetEditComponent implements OnInit {
  vetEditForm: FormGroup;
  idCtrl: FormControl;
  firstNameCtrl: FormControl;
  lastNameCtrl: FormControl;
  specialtiesCtrl: FormControl;
  vet: Vet;
  specList: Specialty[];
  errorMessage: string;

  constructor(private formBuilder: FormBuilder, private specialtyService: SpecialtyService,
              private vetService: VetService, private route: ActivatedRoute, private router: Router) {
    this.vet = {} as Vet;
    this.specList = [] as Specialty[];
    this.buildForm();
  }

  buildForm() {
    this.idCtrl = new FormControl(null);
    this.firstNameCtrl = new FormControl('', [Validators.required, Validators.minLength(1)]);
    this.lastNameCtrl = new FormControl('', [Validators.required, Validators.minLength(1)]);
    this.specialtiesCtrl = new FormControl(null);
    this.vetEditForm = this.formBuilder.group({
      id: this.idCtrl,
      firstName: this.firstNameCtrl,
      lastName: this.lastNameCtrl,
      specialties: this.specialtiesCtrl
    });
  }

  compareSpecFn(c1: Specialty, c2: Specialty): boolean {
    return c1 && c2 ? c1.id === c2.id : c1 === c2;
  }

  initFormValues() {
    this.idCtrl.setValue(this.vet.id);
    this.firstNameCtrl.setValue(this.vet.firstName);
    this.lastNameCtrl.setValue(this.vet.lastName);
    this.specialtiesCtrl.setValue(this.vet.specialties);
  }

  ngOnInit() {
    // we use SpecResolver and VetResolver (get data before init component)
    this.specList = this.route.snapshot.data.specs;
    this.vet = this.route.snapshot.data.vet;
    this.vet.specialties = this.route.snapshot.data.vet.specialties;
    this.initFormValues();
  }

  onSubmit(vet: Vet) {
    this.vetService.updateVet(vet.id.toString(), vet).subscribe(
      res => {
        console.log('update success');
        this.gotoVetList();
      },
      error => this.errorMessage = error as any);

  }

  gotoVetList() {
    this.router.navigate(['/vets']);
  }

}
