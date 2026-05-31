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
 * REST controller for pets.
 *
 * No service layer — the controller injects the TypeORM repository directly
 * and uses stateless mapper functions.
 *
 * The whole controller requires the OWNER_ADMIN role via @Roles('ROLE_OWNER_ADMIN').
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
   * GET /api/pets/{petId} — returns the pet, or 404 when absent.
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
   * GET /api/pets — lists all pets.
   */
  @Get()
  async listPets(): Promise<PetDto[]> {
    const allPets = await this.petRepository.find({
      relations: { type: true, owner: true, visits: true },
    });
    return toPetsDto(allPets);
  }

  /**
   * PUT /api/pets/{petId} — updates a pet.
   *
   * Loads the pet, mutates name/birthDate/type, and saves it. Returns void / 200.
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
   * DELETE /api/pets/{petId} — returns void (200), or 404 when absent.
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
