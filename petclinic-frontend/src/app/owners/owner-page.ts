import { components } from '../generated/api-types';
import { Owner } from './owner';

/**
 * Backend `PagedModel<OwnerDto>` envelope: rows in `content` (as the app's domain `Owner`),
 * pagination metadata reused from the generated `PageMetadata` so it can't drift from the contract.
 */
export interface OwnerPage {
  content: Owner[];
  page: components['schemas']['PageMetadata'];
}
