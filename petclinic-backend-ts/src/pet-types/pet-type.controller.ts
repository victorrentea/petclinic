import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

import { Roles } from '../common/security/roles.decorator';
import { PetType } from './pet-type.entity';
import { PetTypeDto } from './dto/pet-type.dto';
import { PetTypeFieldsDto } from './dto/pet-type-fields.dto';
import { toPetType, toPetTypeDto, toPetTypeDtos } from './pet-type.mapper';

/**
 * Ported from victor.training.petclinic.rest.PetTypeRestController.
 *
 * No service layer — the controller injects the TypeORM repository directly,
 * mirroring the Java app (Spring Data repository injected into the controller).
 *
 * Class-level @PreAuthorize("hasAnyRole(@roles.OWNER_ADMIN, @roles.VET_ADMIN)").
 */
@ApiTags('pettypes')
@Controller('api/pettypes')
@Roles('ROLE_OWNER_ADMIN', 'ROLE_VET_ADMIN')
export class PetTypeController {
  constructor(
    @InjectRepository(PetType)
    private readonly petTypeRepository: Repository<PetType>,
  ) {}

  /** GET /api/pettypes → 200, list of all pet types. */
  @Get()
  async listPetTypes(): Promise<PetTypeDto[]> {
    const petTypes = await this.petTypeRepository.find();
    return toPetTypeDtos(petTypes);
  }

  /** GET /api/pettypes/{petTypeId} → 200; 404 when missing (Java orElseThrow). */
  @Get(':petTypeId')
  async getPetType(
    @Param('petTypeId', ParseIntPipe) petTypeId: number,
  ): Promise<PetTypeDto> {
    const petType = await this.petTypeRepository.findOneBy({ id: petTypeId });
    if (!petType) {
      throw new NotFoundException();
    }
    return toPetTypeDto(petType);
  }

  /**
   * POST /api/pettypes (consumes application/json) → 201 Created + Location.
   * @PreAuthorize("hasRole(@roles.VET_ADMIN)").
   */
  @Post()
  @Roles('ROLE_VET_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async addPetType(
    @Body() petTypeFieldsDto: PetTypeFieldsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const type = toPetType(petTypeFieldsDto);
    const saved = await this.petTypeRepository.save(type);
    res.location(`/api/pettypes/${saved.id}`);
  }

  /**
   * PUT /api/pettypes/{petTypeId} → 200/void; 404 when missing.
   * @PreAuthorize("hasRole(@roles.VET_ADMIN)").
   */
  @Put(':petTypeId')
  @Roles('ROLE_VET_ADMIN')
  async updatePetType(
    @Param('petTypeId', ParseIntPipe) petTypeId: number,
    @Body() petTypeDto: PetTypeDto,
  ): Promise<void> {
    const currentPetType = await this.petTypeRepository.findOneBy({ id: petTypeId });
    if (!currentPetType) {
      throw new NotFoundException();
    }
    currentPetType.name = petTypeDto.name;
    await this.petTypeRepository.save(currentPetType);
  }

  /**
   * DELETE /api/pettypes/{petTypeId} → 204 No Content.
   * Maps DataIntegrityViolationException (FK in use) to a meaningful error.
   * @PreAuthorize("hasRole(@roles.VET_ADMIN)").
   */
  @Delete(':petTypeId')
  @Roles('ROLE_VET_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePetType(
    @Param('petTypeId', ParseIntPipe) petTypeId: number,
  ): Promise<void> {
    const petType = await this.petTypeRepository.findOneBy({ id: petTypeId });
    if (!petType) {
      throw new NotFoundException();
    }
    try {
      await this.petTypeRepository.remove(petType);
    } catch (ex) {
      if (ex instanceof QueryFailedError) {
        throw new Error('PetType is in use by existing pets and cannot be deleted');
      }
      throw ex;
    }
  }
}
