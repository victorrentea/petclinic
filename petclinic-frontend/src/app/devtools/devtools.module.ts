import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DevtoolsRoutingModule} from './devtools-routing.module';
import {MockServerComponent} from './mock-server/mock-server.component';
import {WiremockService} from './wiremock.service';

@NgModule({
  imports: [
    CommonModule,
    DevtoolsRoutingModule
  ],
  declarations: [
    MockServerComponent
  ],
  providers: [WiremockService]
})
export class DevtoolsModule {
}
