export interface PetSummary {
  id: number;
  name: string;
}

export interface OwnerSummary {
  id: number;
  displayName: string;
  address: string;
  city: string;
  telephone: string;
  pets: PetSummary[];
}
