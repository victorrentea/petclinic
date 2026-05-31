import { Repository } from 'typeorm';
import { Owner } from '../../owners/owner.entity';
import { Pet } from '../../pets/pet.entity';
import { Visit } from '../../visits/visit.entity';
import { todayIsoDate } from '../../visits/visit.entity';

/**
 * Ported from victor.training.petclinic.mcp.VisitMcpTools.
 *
 * Three tools — list_visits (readOnly), create_visit (elicits a phone number,
 * requires confirmation), cancel_visit (destructive). Validation, ordering and
 * user-facing messages are reproduced faithfully from the Java tools.
 *
 * Stateless plain functions (no Nest DI), matching the project's mapper
 * convention. The MCP wiring supplies the repositories, the authenticated
 * owner id, and an `elicit` callback bound to the current MCP connection.
 */

/** Mirrors VisitMcpTools.VisitView record. */
export interface VisitView {
  id: number;
  petId: number;
  petName: string;
  date: string | undefined;
  description: string | undefined;
}

/** Mirrors VisitMcpTools.VisitPhoneInput record. */
export interface VisitPhoneInput {
  phone?: string;
}

/** Repositories needed by the visit tools (injected by the MCP wiring). */
export interface VisitToolRepos {
  ownerRepository: Repository<Owner>;
  petRepository: Repository<Pet>;
  visitRepository: Repository<Visit>;
}

/** Result of an elicitation, mirroring io.modelcontextprotocol ElicitResult. */
export interface ElicitOutcome {
  /** 'accept' | 'decline' | 'cancel'. */
  action: string;
  content?: VisitPhoneInput;
}

/**
 * Abstraction over the MCP connection used by create_visit. Mirrors
 * McpSyncRequestContext: whether elicitation is enabled + the elicit call.
 */
export interface VisitToolContext {
  /** Mirrors McpSyncRequestContext.elicitEnabled(). */
  elicitEnabled(): boolean;
  /** Mirrors context.elicit(...) — prompts the user for a phone number. */
  elicitPhone(message: string): Promise<ElicitOutcome>;
}

const ELICIT_DECLINE = 'decline';
const ELICIT_ACCEPT = 'accept';

/**
 * Mirrors `requireFutureDate`: throws when the date is strictly before today.
 * Compares ISO 'YYYY-MM-DD' strings (lexicographic == chronological).
 */
function requireFutureDate(date: string): void {
  if (date < todayIsoDate()) {
    throw new Error(`Visit date must be today or in the future: ${date}`);
  }
}

/** Mirrors `LocalDate.parse(date)`: validates strict ISO 'YYYY-MM-DD'. */
function parseIsoDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Text '${date}' could not be parsed as a date (expected yyyy-MM-dd)`);
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Text '${date}' could not be parsed as a date (expected yyyy-MM-dd)`);
  }
  return date;
}

/**
 * Mirrors VisitRepository.findByPetId(petId): plain visits, no join fetch.
 */
function findVisitsByPetId(
  visitRepository: Repository<Visit>,
  petId: number,
): Promise<Visit[]> {
  return visitRepository.find({ where: { pet: { id: petId } } });
}

/**
 * Mirrors OwnerRepository.findByIdFetchingPets(ownerId):
 * `SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id`.
 */
function findOwnerFetchingPets(
  ownerRepository: Repository<Owner>,
  ownerId: number,
): Promise<Owner | null> {
  return ownerRepository.findOne({
    where: { id: ownerId },
    relations: { pets: true },
  });
}

/**
 * Tool `list_visits` (readOnlyHint=true, openWorldHint=false): every visit of
 * every pet of the authenticated owner. Mirrors VisitMcpTools.listVisits().
 */
export async function listVisits(repos: VisitToolRepos, ownerId: number): Promise<VisitView[]> {
  const owner = await findOwnerFetchingPets(repos.ownerRepository, ownerId);
  if (!owner) {
    throw new Error(`Owner not found: ${ownerId}`);
  }
  const result: VisitView[] = [];
  for (const pet of owner.getPets()) {
    for (const v of await findVisitsByPetId(repos.visitRepository, pet.id)) {
      result.push({
        id: v.id,
        petId: pet.id,
        petName: pet.name ?? '',
        date: v.date,
        description: v.description,
      });
    }
  }
  return result;
}

/**
 * Tool `create_visit`: creates a vet visit for one of the owner's pets after
 * eliciting + confirming a phone number. Mirrors VisitMcpTools.createVisit().
 *
 * Validation order is preserved exactly: pet exists -> pet belongs to owner ->
 * date parses -> date is today/future -> elicitation enabled -> elicit ->
 * accept? -> phone non-blank -> save owner phone -> save visit.
 */
export async function createVisit(
  repos: VisitToolRepos,
  ownerId: number,
  context: VisitToolContext,
  petId: number,
  date: string,
  description: string,
): Promise<string> {
  const pet = await repos.petRepository.findOne({
    where: { id: petId },
    relations: { owner: true },
  });
  if (!pet) {
    throw new Error(`Pet not found: ${petId}`);
  }
  if (pet.owner == null || pet.owner.id !== ownerId) {
    throw new Error(`Pet ${petId} does not belong to owner ${ownerId}`);
  }
  const visitDate = parseIsoDate(date);
  requireFutureDate(visitDate);

  if (!context.elicitEnabled()) {
    throw new Error(
      'create_visit requires an MCP client that supports elicitation (owner must confirm).',
    );
  }
  const prompt =
    `Create visit for pet '${pet.name}' on ${visitDate}` +
    ` — "${description}". No phone number on file for you — please provide one to receive reminders.`;
  const elicit = await context.elicitPhone(prompt);
  if (elicit.action !== ELICIT_ACCEPT) {
    return 'Visit creation cancelled by user.';
  }
  const input = elicit.content;
  if (input == null || input.phone == null || input.phone.trim() === '') {
    throw new Error('Phone number is required to schedule a visit.');
  }
  const owner = pet.owner;
  owner.telephone = input.phone.trim();
  await repos.ownerRepository.save(owner);

  const v = new Visit();
  v.pet = pet;
  v.date = visitDate;
  v.description = description;
  const saved = await repos.visitRepository.save(v);
  return (
    `Created visit id=${saved.id} for pet '${pet.name}' on ${visitDate}` +
    `; reminders will be sent to ${owner.telephone}`
  );
}

/**
 * Tool `cancel_visit` (destructiveHint=true): deletes any future-dated visits
 * (across the owner's pets) matching the supplied date. Mirrors
 * VisitMcpTools.cancelVisit().
 */
export async function cancelVisit(
  repos: VisitToolRepos,
  ownerId: number,
  date: string,
): Promise<string> {
  const visitDate = parseIsoDate(date);
  requireFutureDate(visitDate);

  const owner = await findOwnerFetchingPets(repos.ownerRepository, ownerId);
  if (!owner) {
    throw new Error(`Owner not found: ${ownerId}`);
  }

  let cancelled = 0;
  for (const pet of owner.getPets()) {
    for (const v of await findVisitsByPetId(repos.visitRepository, pet.id)) {
      if (v.date === visitDate) {
        await repos.visitRepository.remove(v);
        cancelled++;
      }
    }
  }
  if (cancelled === 0) {
    return `No upcoming visits found on ${visitDate}`;
  }
  return `Cancelled ${cancelled} visit(s) on ${visitDate}`;
}

// Re-exported for the MCP server's elicit-schema builder & decline handling.
export { ELICIT_DECLINE, ELICIT_ACCEPT };
