import { NgModule } from '@angular/core';
import { OwnerNamePipe } from './owner-name.pipe';

/** Small cross-cutting pieces (pipes, directives) shared by owners, pets and visits. */
@NgModule({
  declarations: [OwnerNamePipe],
  exports: [OwnerNamePipe]
})
export class SharedModule {
}
