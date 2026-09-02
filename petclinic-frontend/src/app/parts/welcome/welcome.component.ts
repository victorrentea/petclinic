import {Component, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  ownerCount: number | null = null;

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    this.http.get<number>(environment.REST_API_URL + 'owners/count')
      .subscribe(count => this.ownerCount = count);
  }

}
