import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {MockServerComponent} from './mock-server/mock-server.component';

const devtoolsRoutes: Routes = [
  {path: 'mock-server', component: MockServerComponent}
];

@NgModule({
  imports: [RouterModule.forChild(devtoolsRoutes)],
  exports: [RouterModule]
})
export class DevtoolsRoutingModule {
}
