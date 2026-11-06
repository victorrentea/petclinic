import { components } from '../generated/api-types';
import { Visit } from './visit';

export type VisitPage = Omit<components['schemas']['VisitPageDto'], 'content'> & {
  content: Visit[];
};
