import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Owner } from './owner.entity';
import { Pet } from '../pets/pet.entity';
import { Visit } from '../visits/visit.entity';
import { PetType } from '../pet-types/pet-type.entity';

import { OwnerDto } from './dto/owner.dto';
import { OwnerFieldsDto } from './dto/owner-fields.dto';
import { OwnerListRowDto } from './dto/owner-list-row.dto';
import { ListOwnersQueryDto } from './dto/list-owners-query.dto';
import { PetDto } from '../pets/dto/pet.dto';
import { PetFieldsDto } from '../pets/dto/pet-fields.dto';
import { VisitFieldsDto } from '../visits/dto/visit-fields.dto';

import { toOwner, toOwnerDto, toOwnerListRowDto, OwnerListRawRow } from './owner.mapper';
import { toPetDto, toPetFromFields } from '../pets/pet.mapper';
import { toVisitFromFields } from '../visits/visit.mapper';
import { PageDto, buildPage } from '../common/page.dto';
import { OwnerListPageDto } from './dto/owner-list-page.dto';

import { Roles } from '../common/security/roles.decorator';
import { PermitAll } from '../common/security/permit-all.decorator';

/**
 * Whitelist mapping each accepted sort key to its full ORDER BY column chain.
 *
 * The requested direction applies to every column EXCEPT the final `owner.id`
 * tiebreaker, which is always ASC. Client input is only ever looked up in this
 * map, never interpolated — this map is the SQL-injection boundary for sorting.
 */
const SORT_CHAINS: Record<string, string[]> = {
  name: ['owner.firstName', 'owner.lastName'],
  address: ['owner.address', 'owner.firstName', 'owner.lastName'],
  city: ['owner.city', 'owner.firstName', 'owner.lastName'],
};

/** TEXT columns that need human collation (lower+unaccent) in ORDER BY. */
const COLLATED_COLUMNS = new Set([
  'owner.firstName',
  'owner.lastName',
  'owner.address',
  'owner.city',
]);

/**
 * Maps each whitelisted sort key's entity-qualified columns to the raw SQL
 * column references used in the grouped projection's ORDER BY. Built from the
 * fixed whitelist — never from client input — so it is injection-safe.
 */
const RAW_COLUMNS: Record<string, string> = {
  'owner.firstName': 'owner.first_name',
  'owner.lastName': 'owner.last_name',
  'owner.address': 'owner.address',
  'owner.city': 'owner.city',
};

/**
 * REST controller for owners.
 *
 * No service layer — the controller injects the TypeORM repositories directly
 * and runs the queries itself. Mapping is delegated to the stateless mapper
 * functions.
 *
 * The whole controller requires the OWNER_ADMIN role via @Roles('ROLE_OWNER_ADMIN').
 */
@ApiTags('owner')
@Controller('api/owners')
@Roles('ROLE_OWNER_ADMIN')
export class OwnerController {
  constructor(
    @InjectRepository(Owner) private readonly ownerRepository: Repository<Owner>,
    @InjectRepository(Pet) private readonly petRepository: Repository<Pet>,
    @InjectRepository(Visit) private readonly visitRepository: Repository<Visit>,
    @InjectRepository(PetType) private readonly petTypeRepository: Repository<PetType>,
  ) {}

  /**
   * GET /api/owners — paginated, sorted, last-name-filtered list of owners.
   *
   * Returns a Spring-style page envelope of {@link OwnerListRowDto} (a list
   * read-model: no visits, no pet types, no full pet entities). Pet names are
   * aggregated in SQL. Pagination/sorting/filtering all happen at the DB level —
   * the result set is never materialized in memory.
   */
  @Get()
  @ApiOperation({ operationId: 'listOwners', summary: 'List owners' })
  @ApiOkResponse({ type: OwnerListPageDto })
  async listOwners(@Query() query: ListOwnersQueryDto): Promise<PageDto<OwnerListRowDto>> {
    const escaped = query.lastName.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const prefix = `${escaped}%`;
    const totalElements = await this.countByLastNameStartingWith(prefix);
    const rawRows = await this.findListPage(prefix, query);
    const content = rawRows.map((raw) => toOwnerListRowDto(raw));
    return buildPage(content, totalElements, query.page, query.size);
  }

  /** GET /api/owners/count — publicly reachable (@PermitAll). */
  @Get('count')
  @PermitAll()
  @ApiOperation({ operationId: 'countOwners', summary: 'Count owners' })
  async countOwners(): Promise<number> {
    return this.ownerRepository.count();
  }

  /** GET /api/owners/{ownerId} — returns the owner, or 404 when absent. */
  @Get(':ownerId')
  @ApiOperation({ operationId: 'getOwner', summary: 'Get an owner by ID' })
  @ApiOkResponse({ type: OwnerDto })
  async getOwner(@Param('ownerId', ParseIntPipe) ownerId: number): Promise<OwnerDto> {
    const owner = await this.findByIdFetchingPets(ownerId);
    if (!owner) {
      throw new NotFoundException();
    }
    return toOwnerDto(owner);
  }

  /**
   * POST /api/owners — 201 Created with `Location: /api/owners/{id}`.
   */
  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: 'addOwner', summary: 'Create an owner' })
  @ApiCreatedResponse()
  async addOwner(
    @Body() ownerFieldsDto: OwnerFieldsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const owner = toOwner(ownerFieldsDto);
    const saved = await this.ownerRepository.save(owner);
    response.setHeader('Location', `/api/owners/${saved.id}`);
  }

  /** PUT /api/owners/{ownerId} — 404 when absent, then save. */
  @Put(':ownerId')
  @ApiOperation({ operationId: 'updateOwner', summary: 'Update an owner' })
  async updateOwner(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() ownerFieldsDto: OwnerFieldsDto,
  ): Promise<void> {
    const currentOwner = await this.ownerRepository.findOne({ where: { id: ownerId } });
    if (!currentOwner) {
      throw new NotFoundException();
    }
    currentOwner.address = ownerFieldsDto.address;
    currentOwner.city = ownerFieldsDto.city;
    currentOwner.firstName = ownerFieldsDto.firstName;
    currentOwner.lastName = ownerFieldsDto.lastName;
    currentOwner.telephone = ownerFieldsDto.telephone;
    await this.ownerRepository.save(currentOwner);
  }

  /** DELETE /api/owners/{ownerId} — 404 when absent, then delete (void => 200). */
  @Delete(':ownerId')
  @ApiOperation({ operationId: 'deleteOwner', summary: 'Delete an owner by ID' })
  async deleteOwner(@Param('ownerId', ParseIntPipe) ownerId: number): Promise<void> {
    const owner = await this.ownerRepository.findOne({
      where: { id: ownerId },
      relations: { pets: { visits: true } },
    });
    if (!owner) {
      throw new NotFoundException();
    }
    // Deleting an owner cascades to its pets and (through Pet's own cascade) to
    // each pet's visits. The Postgres FKs have no ON DELETE CASCADE, so delete
    // children bottom-up first.
    for (const pet of owner.pets ?? []) {
      for (const visit of pet.visits ?? []) {
        await this.visitRepository.remove(visit);
      }
      await this.petRepository.remove(pet);
    }
    await this.ownerRepository.remove(owner);
  }

  /**
   * POST /api/owners/{ownerId}/pets — 201 Created with `Location: /api/pets/{id}`.
   * The pet is linked to a stub owner carrying only the id, and its PetType is
   * resolved (404 when the type is absent).
   */
  @Post(':ownerId/pets')
  @HttpCode(201)
  @ApiOperation({ operationId: 'addPetToOwner', summary: 'Add a pet to an owner' })
  @ApiCreatedResponse()
  async addPetToOwner(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() petFieldsDto: PetFieldsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const pet = toPetFromFields(petFieldsDto);
    const ownerStub = new Owner();
    ownerStub.id = ownerId;
    pet.owner = ownerStub;
    const typeId = pet.type?.id as number;
    const type = await this.petTypeRepository.findOne({ where: { id: typeId } });
    if (!type) {
      throw new NotFoundException();
    }
    pet.type = type;
    const saved = await this.petRepository.save(pet);
    response.setHeader('Location', `/api/pets/${saved.id}`);
  }

  /**
   * PUT /api/owners/{ownerId}/pets/{petId} — 404 when either the pet or its new
   * PetType is absent, then save.
   */
  @Put(':ownerId/pets/:petId')
  @ApiOperation({ operationId: 'updateOwnersPet', summary: "Update an owner's pet" })
  async updateOwnersPet(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() petFieldsDto: PetFieldsDto,
  ): Promise<void> {
    const currentPet = await this.petRepository.findOne({ where: { id: petId } });
    if (!currentPet) {
      throw new NotFoundException();
    }
    currentPet.birthDate = petFieldsDto.birthDate;
    currentPet.name = petFieldsDto.name;
    const type = await this.petTypeRepository.findOne({ where: { id: petFieldsDto.type.id } });
    if (!type) {
      throw new NotFoundException();
    }
    currentPet.type = type;
    await this.petRepository.save(currentPet);
  }

  /**
   * POST /api/owners/{ownerId}/pets/{petId}/visits — 201 Created with
   * `Location: /api/pets/{petId}/visits/{id}`. The visit is linked to a stub pet
   * carrying only the id. Note the body here is NOT validated.
   */
  @Post(':ownerId/pets/:petId/visits')
  @HttpCode(201)
  @ApiOperation({ operationId: 'addVisitToOwner', summary: "Add a visit for an owner's pet" })
  @ApiCreatedResponse()
  async addVisitToOwner(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() visitFieldsDto: VisitFieldsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const visit = toVisitFromFields(visitFieldsDto);
    const petStub = new Pet();
    petStub.id = petId;
    visit.pet = petStub;
    const saved = await this.visitRepository.save(visit);
    response.setHeader('Location', `/api/pets/${petId}/visits/${saved.id}`);
  }

  /**
   * GET /api/owners/{ownerId}/pets/{petId} — load the owner (with pets), then
   * pick the pet by id from the owner's collection — 404 on either miss.
   */
  @Get(':ownerId/pets/:petId')
  @ApiOperation({ operationId: 'getOwnersPet', summary: 'Get a pet belonging to an owner' })
  @ApiOkResponse({ type: PetDto })
  async getOwnersPet(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Param('petId', ParseIntPipe) petId: number,
  ): Promise<PetDto> {
    const owner = await this.findByIdFetchingPets(ownerId);
    if (!owner) {
      throw new NotFoundException();
    }
    const pet = owner.getPetById(petId);
    if (!pet) {
      throw new NotFoundException();
    }
    return toPetDto(pet);
  }

  /**
   * COUNT of owners whose last name starts with the given (already-escaped) LIKE
   * prefix. No join — `totalElements` only depends on the owner filter.
   */
  private async countByLastNameStartingWith(prefix: string): Promise<number> {
    return this.ownerRepository
      .createQueryBuilder('owner')
      .where("owner.lastName LIKE :prefix ESCAPE '\\'", { prefix })
      .getCount();
  }

  /**
   * Single grouped projection query for one page of the owners list.
   *
   * LEFT JOINs pet and aggregates pet names in SQL (one row per owner after
   * GROUP BY, so LIMIT/OFFSET paginate correctly). The ORDER BY chain is built
   * server-side from the sort whitelist (never interpolating client input) with
   * human collation + empty-as-empty-string semantics. Returns raw rows whose
   * aliases match {@link OwnerListRawRow}.
   */
  private async findListPage(prefix: string, query: ListOwnersQueryDto): Promise<OwnerListRawRow[]> {
    const qb = this.ownerRepository
      .createQueryBuilder('owner')
      .select('owner.id', 'id')
      .addSelect('owner.first_name', 'firstName')
      .addSelect('owner.last_name', 'lastName')
      .addSelect('owner.address', 'address')
      .addSelect('owner.city', 'city')
      .addSelect('owner.telephone', 'telephone')
      .addSelect('array_remove(array_agg(pet.name ORDER BY pet.name), NULL)', 'petNames')
      .leftJoin('owner.pets', 'pet')
      .where("owner.lastName LIKE :prefix ESCAPE '\\'", { prefix })
      .groupBy('owner.id');

    this.applySortChain(qb, query.sort);

    return qb
      .limit(query.size)
      .offset(query.page * query.size)
      .getRawMany<OwnerListRawRow>();
  }

  /**
   * Expands the requested `sort` (`col,dir`, already validated) into a full
   * ORDER BY chain via the {@link SORT_CHAINS} whitelist, then appends the
   * always-ASC `owner.id` tiebreaker. No `sort` → the default `name,asc` chain.
   * Text columns are wrapped in `lower(unaccent(coalesce(col, '')))` for
   * case/diacritic-insensitive sorting with NULL/empty treated as empty string.
   */
  private applySortChain(qb: SelectQueryBuilder<Owner>, sort?: string): void {
    const [key, dir] = (sort ?? 'name,asc').split(',');
    const direction = dir === 'desc' ? 'DESC' : 'ASC';
    const columns = SORT_CHAINS[key];
    for (const column of columns) {
      const expression = COLLATED_COLUMNS.has(column)
        ? `lower(unaccent(coalesce(${this.toRawColumn(column)}, '')))`
        : this.toRawColumn(column);
      qb.addOrderBy(expression, direction);
    }
    qb.addOrderBy('owner.id', 'ASC');
  }

  /** Maps an entity-qualified column (`owner.firstName`) to its raw SQL column. */
  private toRawColumn(column: string): string {
    return RAW_COLUMNS[column];
  }

  /**
   * Loads an owner by id, left-joining its pets. Eagerly loads pets (and each
   * pet's type + visits) so the mappers can sort and project them without
   * triggering further lazy loads.
   */
  private async findByIdFetchingPets(id: number): Promise<Owner | null> {
    return this.ownerRepository
      .createQueryBuilder('owner')
      .leftJoinAndSelect('owner.pets', 'pet')
      .leftJoinAndSelect('pet.type', 'type')
      .leftJoinAndSelect('pet.visits', 'visit')
      .where('owner.id = :id', { id })
      .getOne();
  }
}
