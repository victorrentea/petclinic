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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visit } from './visit.entity';
import { VisitDto } from './dto/visit.dto';
import { VisitFieldsDto } from './dto/visit-fields.dto';
import { toVisit, toVisitDto, toVisitsDto, vetStub } from './visit.mapper';
import { Roles } from '../common/security/roles.decorator';

/**
 * REST controller for visits.
 *
 * No service layer — the controller injects the TypeORM repository directly
 * and calls stateless mapper functions.
 *
 * The whole controller requires the OWNER_ADMIN role via @Roles('ROLE_OWNER_ADMIN').
 */
@ApiTags('visits')
@Roles('ROLE_OWNER_ADMIN')
@Controller('api/visits')
export class VisitController {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
  ) {}

  /** GET /api/visits — lists all visits with their pet, owner and vet eagerly loaded. */
  @Get()
  async listVisits(): Promise<VisitDto[]> {
    const visits = await this.findAllWithPetOwnerAndVet();
    return toVisitsDto(visits);
  }

  /** GET /api/visits/{visitId} — returns the visit; 404 when absent. */
  @Get(':visitId')
  async getVisit(@Param('visitId', ParseIntPipe) visitId: number): Promise<VisitDto> {
    const visit = await this.findByIdOrThrow(visitId);
    return toVisitDto(visit);
  }

  /**
   * POST /api/visits — 201 Created with a Location header
   * `/api/visits/{id}` and an empty body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addVisit(@Body() visitDto: VisitDto, @Res() res: Response): Promise<void> {
    const visit = toVisit(visitDto);
    const saved = await this.visitRepository.save(visit);
    // With @Res() Nest's @HttpCode is bypassed, so set 201 explicitly.
    res.status(HttpStatus.CREATED).location(`/api/visits/${saved.id}`).send();
  }

  /**
   * PUT /api/visits/{visitId} — loads the existing visit (404 if absent),
   * sets date + description + vet only, saves. Returns void (200).
   */
  @Put(':visitId')
  async updateVisit(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() visitDto: VisitFieldsDto,
  ): Promise<void> {
    const currentVisit = await this.findByIdOrThrow(visitId);
    currentVisit.date = visitDto.date;
    currentVisit.description = visitDto.description;
    currentVisit.vet = vetStub(visitDto.vetId);
    await this.visitRepository.save(currentVisit);
  }

  /** DELETE /api/visits/{visitId} — void (200), 404 if absent. */
  @Delete(':visitId')
  async deleteVisit(@Param('visitId', ParseIntPipe) visitId: number): Promise<void> {
    const visit = await this.findByIdOrThrow(visitId);
    await this.visitRepository.remove(visit);
  }

  /**
   * Loads all visits, eagerly selecting each visit's pet, that pet's owner,
   * and the serving vet (left join, defensive — vet_id is NOT NULL).
   */
  private findAllWithPetOwnerAndVet(): Promise<Visit[]> {
    return this.visitRepository
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.pet', 'p')
      .innerJoinAndSelect('p.owner', 'o')
      .leftJoinAndSelect('v.vet', 'vet')
      .getMany();
  }

  /**
   * Finds visits by pet id, returning plain visits with no joined relations.
   * Exposed on the controller (and the controller is exported from
   * VisitsModule) so the MCP layer can reuse it.
   */
  findByPetId(petId: number): Promise<Visit[]> {
    return this.visitRepository.find({ where: { pet: { id: petId } } });
  }

  /** Loads a visit by id, throwing 404 NotFound when missing. */
  private async findByIdOrThrow(visitId: number): Promise<Visit> {
    const visit = await this.visitRepository.findOne({
      where: { id: visitId },
      relations: { pet: { owner: true }, vet: true },
    });
    if (!visit) {
      throw new NotFoundException();
    }
    return visit;
  }
}
