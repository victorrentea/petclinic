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
 * REST controller for vets.
 *
 * No service layer: the controller injects the TypeORM repositories directly
 * and runs the queries itself.
 *
 * The whole controller requires the VET_ADMIN role via @Roles('ROLE_VET_ADMIN').
 * The globally registered RolesGuard reads this metadata; controllers only
 * attach @Roles.
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
   * GET /api/vets — lists all vets with their specialties left-joined.
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
   * GET /api/vets/{vetId} — returns the vet, or 404 when absent.
   */
  @Get(':vetId')
  async getVet(@Param('vetId', ParseIntPipe) vetId: number): Promise<VetDto> {
    const vet = await this.findByIdOrThrow(vetId);
    return toVetDto(vet);
  }

  /**
   * POST /api/vets -> 201 Created with a `Location: /api/vets/{id}` header.
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
   * PUT /api/vets/{vetId} -> 200 / void.
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
   * If the vet has specialties, re-resolve them by name so detached/new
   * Specialty instances become persisted entities, then save.
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
   * DELETE /api/vets/{vetId} -> void. 404 when absent, then delete.
   */
  @Delete(':vetId')
  async deleteVet(
    @Param('vetId', ParseIntPipe) vetId: number,
  ): Promise<void> {
    const vet = await this.findByIdOrThrow(vetId);
    await this.vetRepository.remove(vet);
  }

  /**
   * Loads a vet by id (left-joining its specialties), throwing 404 Not Found
   * when missing.
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
