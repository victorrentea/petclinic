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
import { toVisit, toVisitDto, toVisitsDto } from './visit.mapper';
import { Roles } from '../common/security/roles.decorator';

/**
 * Ported from victor.training.petclinic.rest.VisitRestController.
 *
 * Mirrors the Java design: NO service layer — the controller injects the
 * TypeORM repository directly and calls stateless mapper functions.
 *
 * Class-level `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")` -> @Roles('ROLE_OWNER_ADMIN').
 */
@ApiTags('visits')
@Roles('ROLE_OWNER_ADMIN')
@Controller('api/visits')
export class VisitController {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
  ) {}

  /** GET /api/visits — mirrors listVisits() using findAllWithPetAndOwner (JOIN FETCH). */
  @Get()
  async listVisits(): Promise<VisitDto[]> {
    const visits = await this.findAllWithPetAndOwner();
    return toVisitsDto(visits);
  }

  /** GET /api/visits/{visitId} — mirrors getVisit(); 404 when absent (orElseThrow). */
  @Get(':visitId')
  async getVisit(@Param('visitId', ParseIntPipe) visitId: number): Promise<VisitDto> {
    const visit = await this.findByIdOrThrow(visitId);
    return toVisitDto(visit);
  }

  /**
   * POST /api/visits — mirrors addVisit(): 201 Created with a
   * Location header `/api/visits/{id}` and an empty body.
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
   * PUT /api/visits/{visitId} — mirrors updateVisit(): loads the existing visit
   * (404 if absent), sets date + description only, saves. Returns void (200).
   */
  @Put(':visitId')
  async updateVisit(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() visitDto: VisitFieldsDto,
  ): Promise<void> {
    const currentVisit = await this.findByIdOrThrow(visitId);
    currentVisit.date = visitDto.date;
    currentVisit.description = visitDto.description;
    await this.visitRepository.save(currentVisit);
  }

  /** DELETE /api/visits/{visitId} — mirrors deleteVisit(); void (200), 404 if absent. */
  @Delete(':visitId')
  async deleteVisit(@Param('visitId', ParseIntPipe) visitId: number): Promise<void> {
    const visit = await this.findByIdOrThrow(visitId);
    await this.visitRepository.remove(visit);
  }

  /**
   * Mirrors VisitRepository.findAllWithPetAndOwner():
   * `SELECT v FROM Visit v JOIN FETCH v.pet p JOIN FETCH p.owner`.
   * JOIN FETCH == INNER join + eager select of the joined rows.
   */
  private findAllWithPetAndOwner(): Promise<Visit[]> {
    return this.visitRepository
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.pet', 'p')
      .innerJoinAndSelect('p.owner', 'o')
      .getMany();
  }

  /**
   * Mirrors VisitRepository.findByPetId(int petId) — a derived query with NO
   * join fetch (returns plain visits). Exposed on the controller (and the
   * controller is exported from VisitsModule) so the MCP layer can reuse it,
   * matching the Java MCP tools which call visitRepository.findByPetId(petId).
   */
  findByPetId(petId: number): Promise<Visit[]> {
    return this.visitRepository.find({ where: { pet: { id: petId } } });
  }

  /** Mirrors `visitRepository.findById(id).orElseThrow()` -> 404 NotFound. */
  private async findByIdOrThrow(visitId: number): Promise<Visit> {
    const visit = await this.visitRepository.findOne({
      where: { id: visitId },
      relations: { pet: { owner: true } },
    });
    if (!visit) {
      throw new NotFoundException();
    }
    return visit;
  }
}
