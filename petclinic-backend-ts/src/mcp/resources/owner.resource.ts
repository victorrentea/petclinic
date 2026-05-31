import { Repository } from 'typeorm';
import { Owner } from '../../owners/owner.entity';
import { Pet } from '../../pets/pet.entity';

/**
 * The owner MCP resource.
 *
 * Resource uri `me://profile`, name `me_profile`: returns the authenticated
 * owner's markdown profile (name, address, phone, pets).
 *
 * Stateless plain function (matches the project's stateless-mapper convention);
 * the owner id + repository are supplied by the MCP wiring per request.
 */
export const OWNER_RESOURCE_URI = 'me://profile';
export const OWNER_RESOURCE_NAME = 'me_profile';
export const OWNER_RESOURCE_DESCRIPTION =
  "The authenticated owner's profile: name, address, phone, and pets.";

/**
 * Loads an owner by id, eagerly fetching its pets and each pet's type.
 */
export function findOwnerFetchingPets(
  ownerRepository: Repository<Owner>,
  ownerId: number,
): Promise<Owner | null> {
  return ownerRepository.findOne({
    where: { id: ownerId },
    relations: { pets: { type: true } },
  });
}

/** Formats a single pet line: `- id=.. — name (type), born date`. */
function formatPet(pet: Pet): string {
  const type = pet.type == null ? '?' : (pet.type.name ?? '?');
  return `- id=${pet.id} — ${pet.name} (${type}), born ${pet.birthDate}`;
}

/**
 * Builds the markdown profile for the authenticated owner. Throws when the
 * owner cannot be found.
 */
export async function buildOwnerProfileMarkdown(
  ownerRepository: Repository<Owner>,
  ownerId: number,
): Promise<string> {
  const owner = await findOwnerFetchingPets(ownerRepository, ownerId);
  if (!owner) {
    throw new Error(`No owner with id=${ownerId}`);
  }

  // Pets sorted by name ascending.
  const pets = owner.getPets();
  const petLines = pets.map(formatPet).join('\n');

  // Left-aligned markdown profile.
  return (
    `# ${owner.firstName} ${owner.lastName}\n` +
    `- Address: ${owner.address}, ${owner.city}\n` +
    `- Phone: ${owner.telephone}\n` +
    `\n` +
    `## Pets (${pets.length})\n` +
    `${petLines}\n`
  );
}
