import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../environments/environment';

/** One WireMock stub mapping generated from an example in the Swagger. */
export interface WiremockStub {
  name: string;
  method: string;
  urlPath: string;
  status: number;
  json: string;
}

/** The stubs that would be / were generated, plus where the spec was read from. */
export interface MappingsPreview {
  openApiPath: string;
  stubs: WiremockStub[];
}

/** A snapshot of the mock server's state. */
export interface WiremockStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  command: string | null;
  stubCount: number;
}

/**
 * Talks to the backend dev-tools endpoints (`/api/devtools/wiremock/*`) that generate WireMock
 * stubs from the Swagger examples and start/stop a real WireMock process. These endpoints are
 * hidden from the OpenAPI contract, so this service is hand-written rather than generated.
 */
@Injectable()
export class WiremockService {

  private readonly baseUrl = environment.REST_API_URL + 'devtools/wiremock';

  constructor(private http: HttpClient) {
  }

  previewStubs(): Observable<MappingsPreview> {
    return this.http.get<MappingsPreview>(this.baseUrl + '/mappings');
  }

  status(): Observable<WiremockStatus> {
    return this.http.get<WiremockStatus>(this.baseUrl + '/status');
  }

  start(): Observable<WiremockStatus> {
    return this.http.post<WiremockStatus>(this.baseUrl + '/start', {});
  }

  stop(): Observable<WiremockStatus> {
    return this.http.post<WiremockStatus>(this.baseUrl + '/stop', {});
  }

  /** Hits the live mock directly (CORS is enabled on the WireMock process) to prove a stub serves. */
  tryOnMock(mockUrl: string, urlPath: string): Observable<unknown> {
    return this.http.get<unknown>(mockUrl + urlPath);
  }
}
