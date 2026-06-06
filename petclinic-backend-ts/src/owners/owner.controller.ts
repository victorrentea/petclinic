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
import { Repository } from 'typeorm';

import { Owner } from './owner.entity';
import { Pet } from '../pets/pet.entity';
import { Visit } from '../visits/visit.entity';
import { PetType } from '../pets/pet-type.entity';

import { OwnerDto } from './dto/owner.dto';
import { OwnerFieldsDto } from './dto/owner-fields.dto';
import { PetDto } from '../pets/dto/pet.dto';
import { PetFieldsDto } from '../pets/dto/pet-fields.dto';
import { VisitFieldsDto } from '../visits/dto/visit-fields.dto';

import { toOwner, toOwnerDto, toOwnerDtoCollection } from './owner.mapper';
import { toPetDto, toPetFromFields } from '../pets/pet.mapper';
import { toVisitFromFields } from '../visits/visit.mapper';

import { Roles } from '../common/security/roles.decorator';
import { PermitAll } from '../common/security/permit-all.decorator';

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
   * GET /api/owners?lastName= — filters by a case-sensitive prefix on last name
   * (`WHERE last_name LIKE :lastName%`); an empty lastName matches every owner.
   */
  @Get()
  @ApiOperation({ operationId: 'listOwners', summary: 'List owners' })
  @ApiOkResponse({ type: [OwnerDto] })
  async listOwners(@Query('lastName') lastName = ''): Promise<OwnerDto[]> {
    const owners = await this.findByLastNameStartingWith(lastName);
    return toOwnerDtoCollection(owners);
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
    currentPet.birthDate = petFieldsDto.birthDate ? new Date(petFieldsDto.birthDate) : undefined;
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
   * Finds owners whose last name starts with the given prefix (case-sensitive
   * LIKE). Implemented with a QueryBuilder, escaping LIKE wildcards in the
   * user-supplied prefix.
   */
  private async findByLastNameStartingWith(lastName: string): Promise<Owner[]> {
    const escaped = lastName.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    // Eager-load pets (+ each pet's type and visits) so the owner mapper can
    // project them, so each owner in the list carries its full pets/visits.
    // Order by owner id to keep the list stable (id-ascending).
    return this.ownerRepository
      .createQueryBuilder('owner')
      .leftJoinAndSelect('owner.pets', 'pet')
      .leftJoinAndSelect('pet.type', 'type')
      .leftJoinAndSelect('pet.visits', 'visit')
      .where("owner.lastName LIKE :prefix ESCAPE '\\'", { prefix: `${escaped}%` })
      .orderBy('owner.id', 'ASC')
      .getMany();
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
      .leftJoinAndSelect('visit.vet', 'vet')
      .where('owner.id = :id', { id })
      .getOne();
  }
}
