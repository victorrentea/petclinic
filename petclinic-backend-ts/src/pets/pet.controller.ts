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
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from './pet.entity';
import { PetDto } from './dto/pet.dto';
import { Roles } from '../common/security/roles.decorator';
import { toPetDto, toPetsDto, toPetType } from './pet.mapper';

/**
 * Ported from victor.training.petclinic.rest.PetRestController.
 *
 * Mirrors the Java design: NO service layer — the controller injects the
 * TypeORM repository directly and uses stateless mapper functions.
 *
 * Class-level @PreAuthorize("hasRole(@roles.OWNER_ADMIN)") -> @Roles('ROLE_OWNER_ADMIN').
 */
@ApiTags('pets')
@Controller('api/pets')
@Roles('ROLE_OWNER_ADMIN')
export class PetController {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  /**
   * GET /api/pets/{petId} — mirrors getPet.
   * Java `findById(petId).orElseThrow()` -> 404 when absent.
   */
  @Get(':petId')
  async getPet(@Param('petId', ParseIntPipe) petId: number): Promise<PetDto> {
    const pet = await this.petRepository.findOne({
      where: { id: petId },
      relations: { type: true, owner: true, visits: true },
    });
    if (!pet) {
      throw new NotFoundException('Not found!');
    }
    return toPetDto(pet);
  }

  /**
   * GET /api/pets — mirrors listPets (produces "application/json").
   */
  @Get()
  async listPets(): Promise<PetDto[]> {
    const allPets = await this.petRepository.find({
      relations: { type: true, owner: true, visits: true },
    });
    return toPetsDto(allPets);
  }

  /**
   * PUT /api/pets/{petId} — mirrors updatePet.
   *
   * Java is @Transactional and relies on JPA dirty-checking: it loads the pet,
   * mutates name/birthDate/type via setters, and the changes flush on commit
   * (no explicit save). TypeORM has no such session, so we load + mutate + save.
   * Returns void / 200, exactly like the Java method (which has no body).
   */
  @Put(':petId')
  async updatePet(
    @Param('petId', ParseIntPipe) petId: number,
    @Body() petDto: PetDto,
  ): Promise<void> {
    const currentPet = await this.petRepository.findOne({ where: { id: petId } });
    if (!currentPet) {
      throw new NotFoundException('Not found!');
    }
    currentPet.birthDate = petDto.birthDate;
    currentPet.name = petDto.name;
    currentPet.type = toPetType(petDto.type);
    await this.petRepository.save(currentPet);
  }

  /**
   * DELETE /api/pets/{petId} — mirrors deletePet.
   * Java returns void (200). `findById(petId).orElseThrow()` -> 404 when absent.
   */
  @Delete(':petId')
  @HttpCode(HttpStatus.OK)
  async deletePet(@Param('petId', ParseIntPipe) petId: number): Promise<void> {
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException('Not found!');
    }
    await this.petRepository.remove(pet);
  }
}
