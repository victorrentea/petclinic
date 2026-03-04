import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
import {VetListComponent} from './vet-list/vet-list.component';
import {VetService} from './vet.service';
import {VetsRoutingModule} from './vets-routing.module';
import {VetEditComponent} from './vet-edit/vet-edit.component';
import {VetAddComponent} from './vet-add/vet-add.component';
import {VetResolver} from './vet-resolver';
import {VetReviewFormComponent} from './vet-review-form/vet-review-form.component';
import {VetReviewPreviewComponent} from './vet-review-preview/vet-review-preview.component';
import {VetReviewDetailsComponent} from './vet-review-details/vet-review-details.component';
import {ReviewService} from './review.service';
import {SanitizationService} from './sanitization.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    VetsRoutingModule
  ],
  declarations: [
    VetListComponent,
    VetEditComponent,
    VetAddComponent,
    VetReviewFormComponent,
    VetReviewPreviewComponent,
    VetReviewDetailsComponent
  ],
  exports: [
    VetListComponent,
    VetEditComponent,
    VetAddComponent,
    VetReviewFormComponent,
    VetReviewPreviewComponent,
    VetReviewDetailsComponent
  ],
  providers: [VetService, VetResolver, ReviewService, SanitizationService]
})
export class VetsModule {
}
