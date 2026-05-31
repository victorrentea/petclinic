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
import { Response } from 'express';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Vet } from './vet.entity';
import { Specialty } from '../specialties/specialty.entity';
import { VetDto } from './dto/vet.dto';
import { toVet, toVetDto, toVetDtos } from './vet.mapper';
import { toSpecialties } from '../specialties/specialty.mapper';
import { Roles } from '../common/security/roles.decorator';

/**
 * Ported from victor.training.petclinic.rest.VetRestController.
 *
 * No service layer (mirrors Java): the controller injects the TypeORM
 * repositories directly and runs the queries the Java repositories declared.
 *
 * Class-level `@PreAuthorize("hasRole(@roles.VET_ADMIN)")` -> @Roles('ROLE_VET_ADMIN').
 * The (globally registered, security-phase-owned) RolesGuard reads this metadata;
 * controllers only attach @Roles, mirroring how every Java controller carries a
 * single class-level @PreAuthorize.
 */
@ApiTags('vets')
@Controller('api/vets')
@Roles('ROLE_VET_ADMIN')
export class VetController {
  constructor(
    @InjectRepository(Vet)
    private readonly vetRepository: Repository<Vet>,
    @InjectRepository(Specialty)
    private readonly specialtyRepository: Repository<Specialty>,
  ) {}

  /**
   * GET /api/vets
   * Java: `@Query("SELECT DISTINCT v FROM Vet v LEFT JOIN FETCH v.specialties")`.
   */
  @Get()
  async listVets(): Promise<VetDto[]> {
    const allVets = await this.vetRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.specialties', 'specialty')
      .distinct(true)
      .getMany();
    return toVetDtos(allVets);
  }

  /**
   * GET /api/vets/{vetId}
   * Java: `@Query("... WHERE v.id = :id")` + `orElseThrow()` -> 404.
   */
  @Get(':vetId')
  async getVet(@Param('vetId', ParseIntPipe) vetId: number): Promise<VetDto> {
    const vet = await this.findByIdOrThrow(vetId);
    return toVetDto(vet);
  }

  /**
   * POST /api/vets -> 201 Created with a Location header.
   * Java: `ResponseEntity.created(/api/vets/{id})`.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addVet(
    @Body() vetDto: VetDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const vet = toVet(vetDto);
    await this.updateSpecialties(vet);
    res.location(`/api/vets/${vet.id}`);
  }

  /**
   * PUT /api/vets/{vetId} -> 200 / void (Java returns void).
   */
  @Put(':vetId')
  async updateVet(
    @Param('vetId', ParseIntPipe) vetId: number,
    @Body() vetDto: VetDto,
  ): Promise<void> {
    const currentVet = await this.findByIdOrThrow(vetId);
    currentVet.firstName = vetDto.firstName;
    currentVet.lastName = vetDto.lastName;
    currentVet.clearSpecialties();
    for (const spec of toSpecialties(vetDto.specialties ?? [])) {
      currentVet.addSpecialty(spec);
    }
    await this.updateSpecialties(currentVet);
  }

  /**
   * Java private updateSpecialties: if the vet has specialties, re-resolve them
   * by name (findSpecialtiesByNameIn) so detached/new Specialty instances become
   * managed entities, then save.
   */
  private async updateSpecialties(currentVet: Vet): Promise<void> {
    if (currentVet.getNrOfSpecialties() > 0) {
      const names = [
        ...new Set(currentVet.specialties.map((s) => s.name as string)),
      ];
      const vetSpecialities = await this.specialtyRepository.findBy({
        name: In(names),
      });
      currentVet.specialties = vetSpecialities;
    }
    await this.vetRepository.save(currentVet);
  }

  /**
   * DELETE /api/vets/{vetId} -> void.
   * Java: `@Transactional` findById().orElseThrow() then delete().
   */
  @Delete(':vetId')
  async deleteVet(
    @Param('vetId', ParseIntPipe) vetId: number,
  ): Promise<void> {
    const vet = await this.findByIdOrThrow(vetId);
    await this.vetRepository.remove(vet);
  }

  /**
   * Mirrors the Java `findById` query (LEFT JOIN FETCH specialties) plus
   * `orElseThrow()` -> 404 Not Found.
   */
  private async findByIdOrThrow(vetId: number): Promise<Vet> {
    const vet = await this.vetRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.specialties', 'specialty')
      .where('v.id = :id', { id: vetId })
      .getOne();
    if (!vet) {
      throw new NotFoundException();
    }
    return vet;
  }
}
