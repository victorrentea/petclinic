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
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from './specialty.entity';
import { SpecialtyDto } from './dto/specialty.dto';
import { Roles } from '../common/security/roles.decorator';
import {
  toSpecialty,
  toSpecialtyDto,
  toSpecialtyDtos,
} from './specialty.mapper';

/**
 * Ported from victor.training.petclinic.rest.SpecialtyRestController.
 *
 * @RequestMapping("/api") with sub-paths "/specialties..."; class-level
 * @PreAuthorize("hasRole(@roles.VET_ADMIN)") → @Roles('ROLE_VET_ADMIN').
 *
 * No service layer: the TypeORM repository is injected directly and the
 * stateless mapper functions are imported.
 */
@Controller('api')
@Roles('ROLE_VET_ADMIN')
export class SpecialtyController {
  constructor(
    @InjectRepository(Specialty)
    private readonly specialtyRepository: Repository<Specialty>,
  ) {}

  @Get('/specialties')
  async listSpecialties(): Promise<SpecialtyDto[]> {
    const allSpecialties = await this.specialtyRepository.find();
    return toSpecialtyDtos(allSpecialties);
  }

  @Get('/specialties/:specialtyId')
  async getSpecialty(
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ): Promise<SpecialtyDto> {
    const specialty = await this.findByIdOrThrow(specialtyId);
    return toSpecialtyDto(specialty);
  }

  @Post('/specialties')
  @HttpCode(HttpStatus.CREATED)
  async addSpecialty(
    @Body() specialtyDto: SpecialtyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const specialty = toSpecialty(specialtyDto);
    const saved = await this.specialtyRepository.save(specialty);
    res.location(`/api/specialties/${saved.id}`);
  }

  @Put('/specialties/:specialtyId')
  async updateSpecialty(
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
    @Body() specialtyDto: SpecialtyDto,
  ): Promise<void> {
    const currentSpecialty = await this.findByIdOrThrow(specialtyId);
    currentSpecialty.name = specialtyDto.name;
    await this.specialtyRepository.save(currentSpecialty);
  }

  @Delete('/specialties/:specialtyId')
  async deleteSpecialty(
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ): Promise<void> {
    const specialty = await this.findByIdOrThrow(specialtyId);
    await this.specialtyRepository.remove(specialty);
  }

  /** Mirrors Java's `findById(id).orElseThrow()` → 404 when missing. */
  private async findByIdOrThrow(id: number): Promise<Specialty> {
    const specialty = await this.specialtyRepository.findOneBy({ id });
    if (!specialty) {
      throw new NotFoundException();
    }
    return specialty;
  }
}
