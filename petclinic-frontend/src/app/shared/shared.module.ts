import {NgModule} from '@angular/core';
import {OwnerNamePipe} from './owner-name.pipe';

/** Pipes every feature module showing an owner needs. */
@NgModule({
  declarations: [OwnerNamePipe],
  exports: [OwnerNamePipe]
})
export class SharedModule {
}
