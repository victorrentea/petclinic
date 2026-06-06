import { Owner } from '../../owners/owner.entity';
import { Pet } from '../../pets/pet.entity';
import { Vet } from '../../vets/vet.entity';
import { Visit, todayIsoDate } from '../../visits/visit.entity';
import { createVisit, listVisits, VisitToolContext, VisitToolRepos } from './visit.tools';

/**
 * Unit tests for the visit MCP tools, with hand-stubbed repositories
 * (no Nest, no database).
 */

function vet(id: number, firstName: string, lastName: string): Vet {
  const v = new Vet();
  v.id = id;
  v.firstName = firstName;
  v.lastName = lastName;
  return v;
}

function ownerWithPet(ownerId: number, petId: number): { owner: Owner; pet: Pet } {
  const owner = new Owner();
  owner.id = ownerId;
  const pet = new Pet();
  pet.id = petId;
  pet.name = 'Leo';
  pet.owner = owner;
  owner.pets = [pet];
  return { owner, pet };
}

/** Builds a VisitToolRepos stub; each repo only implements what the tools call. */
function buildRepos(opts: {
  owner?: Owner;
  pet?: Pet;
  vet?: Vet | null;
  visits?: Visit[];
}): { repos: VisitToolRepos; savedVisits: Visit[] } {
  const savedVisits: Visit[] = [];
  const repos = {
    ownerRepository: {
      findOne: async () => opts.owner ?? null,
      save: async (o: Owner) => o,
    },
    petRepository: {
      findOne: async () => opts.pet ?? null,
    },
    visitRepository: {
      find: async () => opts.visits ?? [],
      save: async (v: Visit) => {
        savedVisits.push(v);
        v.id = 77;
        return v;
      },
    },
    vetRepository: {
      findOne: async () => opts.vet ?? null,
    },
  } as unknown as VisitToolRepos;
  return { repos, savedVisits };
}

const acceptingContext: VisitToolContext = {
  elicitEnabled: () => true,
  elicitPhone: async () => ({ action: 'accept', content: { phone: '0712345678' } }),
};

describe('listVisits', () => {
  it('includes the vet fields in each visit view', async () => {
    const { owner, pet } = ownerWithPet(1, 10);
    const visit = new Visit();
    visit.id = 5;
    visit.date = '2025-05-05';
    visit.description = 'rabies shot';
    visit.vet = vet(3, 'Helen', 'Leary');
    const { repos } = buildRepos({ owner, visits: [visit] });

    const views = await listVisits(repos, 1);

    expect(views).toEqual([
      {
        id: 5,
        petId: 10,
        petName: 'Leo',
        date: '2025-05-05',
        description: 'rabies shot',
        vetId: 3,
        vetFirstName: 'Helen',
        vetLastName: 'Leary',
      },
    ]);
  });
});

describe('createVisit', () => {
  it('rejects an unknown vetId', async () => {
    const { pet } = ownerWithPet(1, 10);
    const { repos } = buildRepos({ pet, vet: null });

    await expect(
      createVisit(repos, 1, acceptingContext, 10, 99, todayIsoDate(), 'checkup'),
    ).rejects.toThrow('Vet not found: 99');
  });

  it('saves the visit with the requested vet', async () => {
    const { pet } = ownerWithPet(1, 10);
    const helen = vet(3, 'Helen', 'Leary');
    const { repos, savedVisits } = buildRepos({ pet, vet: helen });

    const message = await createVisit(
      repos,
      1,
      acceptingContext,
      10,
      3,
      todayIsoDate(),
      'checkup',
    );

    expect(savedVisits).toHaveLength(1);
    expect(savedVisits[0].vet).toBe(helen);
    expect(message).toContain('Created visit id=77');
  });
});
