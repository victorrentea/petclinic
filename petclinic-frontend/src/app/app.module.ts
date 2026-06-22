import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClientModule, HTTP_INTERCEPTORS} from '@angular/common/http';
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {OwnersModule} from './owners/owners.module';
import {PetsModule} from './pets/pets.module';
import {VisitsModule} from './visits/visits.module';
import {PetTypesModule} from './pettypes/pettypes.module';
import {VetsModule} from './vets/vets.module';
import {PartsModule} from './parts/parts.module';
import {SpecialtiesModule} from './specialties/specialties.module';
import {HttpErrorHandler} from './error.service';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatButtonModule} from '@angular/material/button';
import {HttpErrorInterceptor} from './http-error.interceptor';
import {LinkifySnackbarComponent} from './shared/linkify-snackbar/linkify-snackbar.component';

@NgModule({
  declarations: [
    AppComponent,
    LinkifySnackbarComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    OwnersModule,
    PetsModule,
    VisitsModule,
    PetTypesModule,
    VetsModule,
    SpecialtiesModule,
    PartsModule,
    BrowserAnimationsModule,
    MatSnackBarModule,
    MatButtonModule,
    AppRoutingModule
  ],
  providers: [
    HttpErrorHandler,
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
