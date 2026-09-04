package victor.training.petclinic.mapper;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Role;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.domain.User;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.PetTypeFieldsDto;
import victor.training.petclinic.rest.dto.RoleDto;
import victor.training.petclinic.rest.dto.SpecialtyDto;
import victor.training.petclinic.rest.dto.UserDto;
import victor.training.petclinic.rest.dto.VetDto;
import victor.training.petclinic.rest.dto.VetFieldsDto;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The mappers are ordinary code, so the round-trips they perform — nested ids flattened
 * into the DTO, collections rebuilt on the way back — are asserted here rather than taken
 * on trust.
 */
class MapperTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(2020, 1, 1);

    private final SpecialtyMapper specialtyMapper = new SpecialtyMapper();
    private final PetTypeMapper petTypeMapper = new PetTypeMapper();
    private final UserMapper userMapper = new UserMapper();
    private final VisitMapper visitMapper = new VisitMapper();
    private final PetMapper petMapper = new PetMapper(visitMapper);
    private final OwnerMapper ownerMapper = new OwnerMapper(petMapper);
    private final VetMapper vetMapper = new VetMapper(specialtyMapper);

    @Test
    void petToDto_flattens_the_owner_id_and_sorts_the_visits() {
        Owner owner = anOwner();
        owner.setId(7);
        Pet pet = aPet();
        pet.setId(3);
        owner.addPet(pet);
        pet.addVisit(aVisit(LocalDate.of(2024, 1, 1), "older"));
        pet.addVisit(aVisit(LocalDate.of(2025, 1, 1), "newer"));

        PetDto dto = petMapper.toPetDto(pet);

        assertThat(dto.getId()).isEqualTo(3);
        assertThat(dto.getName()).isEqualTo("Leo");
        assertThat(dto.getBirthDate()).isEqualTo(BIRTH_DATE);
        assertThat(dto.getOwnerId()).isEqualTo(7);
        assertThat(dto.getType().getName()).isEqualTo("cat");
        assertThat(dto.getVisits()).extracting(VisitDto::getDescription).containsExactly("newer", "older");
    }

    @Test
    void petToDto_leaves_ownerId_null_for_an_unattached_pet() {
        PetDto dto = petMapper.toPetDto(aPet());

        assertThat(dto.getOwnerId()).isNull();
    }

    @Test
    void dtoToPet_rebuilds_the_owner_reference_and_the_visits() {
        PetDto dto = new PetDto();
        dto.setId(3);
        dto.setName("Leo");
        dto.setBirthDate(BIRTH_DATE);
        dto.setOwnerId(7);
        dto.setType(aPetTypeDto());
        VisitDto visitDto = new VisitDto();
        visitDto.setDescription("rabies shot");
        visitDto.setPetId(3);
        dto.setVisits(List.of(visitDto));

        Pet pet = petMapper.toPet(dto);

        assertThat(pet.getId()).isEqualTo(3);
        assertThat(pet.getOwner().getId()).isEqualTo(7);
        assertThat(pet.getType().getName()).isEqualTo("cat");
        assertThat(pet.getVisits()).extracting(Visit::getDescription).containsExactly("rabies shot");
    }

    @Test
    void fieldsDtoToPet_leaves_the_server_owned_fields_untouched() {
        PetFieldsDto fields = new PetFieldsDto();
        fields.setName("Leo");
        fields.setBirthDate(BIRTH_DATE);
        fields.setType(aPetTypeDto());

        Pet pet = petMapper.toPet(fields);

        assertThat(pet.getId()).isNull();
        assertThat(pet.getOwner()).isNull();
        assertThat(pet.getVisits()).isEmpty();
    }

    @Test
    void petLists_map_both_ways() {
        PetDto dto = new PetDto();
        dto.setName("Leo");

        assertThat(petMapper.toPetsDto(List.of(aPet()))).extracting(PetDto::getName).containsExactly("Leo");
        assertThat(petMapper.toPets(List.of(dto))).extracting(Pet::getName).containsExactly("Leo");
        assertThat(petMapper.toPetTypeDtos(List.of(aPetType()))).extracting(PetTypeDto::getName).containsExactly("cat");
    }

    @Test
    void aNullPetType_maps_to_null_in_both_directions() {
        assertThat(petMapper.toPetTypeDto(null)).isNull();
        assertThat(petMapper.toPetType(null)).isNull();
    }

    @Test
    void aNullCollection_maps_to_an_empty_one_never_to_null() {
        assertThat(petMapper.toPetsDto(null)).isEmpty();
        assertThat(petMapper.toPets(null)).isEmpty();
        assertThat(petMapper.toPetTypeDtos(null)).isEmpty();
        assertThat(petTypeMapper.toPetTypeDtos(null)).isEmpty();
        assertThat(visitMapper.toVisitsDto(null)).isEmpty();
        assertThat(ownerMapper.toOwnerDtoCollection(null)).isEmpty();
        assertThat(specialtyMapper.toSpecialtyDtos(null)).isEmpty();
        assertThat(specialtyMapper.toSpecialty((List<SpecialtyDto>) null)).isEmpty();
        assertThat(vetMapper.toVetDtos(null)).isEmpty();
    }

    @Test
    void ownerToDto_carries_its_pets() {
        Owner owner = anOwner();
        owner.setId(7);
        owner.addPet(aPet());

        var dto = ownerMapper.toOwnerDto(owner);

        assertThat(dto.getId()).isEqualTo(7);
        assertThat(dto.getFirstName()).isEqualTo("Sherlock");
        assertThat(dto.getCity()).isEqualTo("London");
        assertThat(dto.getPets()).extracting(PetDto::getName).containsExactly("Leo");
        assertThat(ownerMapper.toOwnerDtoCollection(List.of(owner))).hasSize(1);
    }

    @Test
    void fieldsDtoToOwner_leaves_the_id_to_the_database() {
        OwnerFieldsDto fields = new OwnerFieldsDto();
        fields.setFirstName("Sherlock");
        fields.setLastName("Holmes");
        fields.setAddress("Baker St 221B");
        fields.setCity("London");
        fields.setTelephone("1234567890");

        Owner owner = ownerMapper.toOwner(fields);

        assertThat(owner.getId()).isNull();
        assertThat(owner.getLastName()).isEqualTo("Holmes");
        assertThat(owner.getTelephone()).isEqualTo("1234567890");
    }

    @Test
    void visitToDto_flattens_the_pet_and_its_owner() {
        Owner owner = anOwner();
        owner.setId(7);
        Pet pet = aPet();
        pet.setId(3);
        owner.addPet(pet);
        Visit visit = aVisit(BIRTH_DATE, "rabies shot");
        visit.setId(11);
        pet.addVisit(visit);

        VisitDto dto = visitMapper.toVisitDto(visit);

        assertThat(dto.getId()).isEqualTo(11);
        assertThat(dto.getPetId()).isEqualTo(3);
        assertThat(dto.getPetName()).isEqualTo("Leo");
        assertThat(dto.getOwnerId()).isEqualTo(7);
        assertThat(dto.getOwnerFirstName()).isEqualTo("Sherlock");
        assertThat(dto.getOwnerLastName()).isEqualTo("Holmes");
    }

    @Test
    void visitToDto_leaves_the_pet_columns_null_when_the_visit_stands_alone() {
        VisitDto dto = visitMapper.toVisitDto(aVisit(BIRTH_DATE, "rabies shot"));

        assertThat(dto.getPetId()).isNull();
        assertThat(dto.getOwnerId()).isNull();
    }

    @Test
    void dtoToVisit_keeps_only_the_pet_id() {
        VisitDto dto = new VisitDto();
        dto.setId(11);
        dto.setDate(BIRTH_DATE);
        dto.setDescription("rabies shot");
        dto.setPetId(3);

        Visit visit = visitMapper.toVisit(dto);

        assertThat(visit.getId()).isEqualTo(11);
        assertThat(visit.getPet().getId()).isEqualTo(3);
        assertThat(visit.getPet().getName()).isNull();
    }

    @Test
    void fieldsDtoToVisit_carries_no_pet_at_all() {
        VisitFieldsDto fields = new VisitFieldsDto();
        fields.setDate(BIRTH_DATE);
        fields.setDescription("rabies shot");

        Visit visit = visitMapper.toVisit(fields);

        assertThat(visit.getId()).isNull();
        assertThat(visit.getPet()).isNull();
        assertThat(visit.getDescription()).isEqualTo("rabies shot");
    }

    @Test
    void petTypeMaps_both_ways_and_to_its_fields_view() {
        PetTypeFieldsDto fields = new PetTypeFieldsDto();
        fields.setName("cat");

        assertThat(petTypeMapper.toPetType(fields).getId()).isNull();
        assertThat(petTypeMapper.toPetType(fields).getName()).isEqualTo("cat");
        assertThat(petTypeMapper.toPetTypeDto(aPetType()).getName()).isEqualTo("cat");
        assertThat(petTypeMapper.toPetTypeFieldsDto(aPetType()).getName()).isEqualTo("cat");
        assertThat(petTypeMapper.toPetTypeDtos(List.of(aPetType()))).hasSize(1);
    }

    @Test
    void specialtyMaps_both_ways() {
        SpecialtyDto dto = new SpecialtyDto();
        dto.setId(2);
        dto.setName("radiology");
        dto.setDescription("limping");

        Specialty specialty = specialtyMapper.toSpecialty(dto);

        assertThat(specialty.getId()).isEqualTo(2);
        assertThat(specialty.getDescription()).isEqualTo("limping");
        assertThat(specialtyMapper.toSpecialtyDto(specialty).getName()).isEqualTo("radiology");
        assertThat(specialtyMapper.toSpecialty(List.of(dto))).hasSize(1);
        assertThat(specialtyMapper.toSpecialtyDtos(List.of(specialty))).hasSize(1);
    }

    @Test
    void vetMaps_both_ways_with_its_specialties() {
        SpecialtyDto specialtyDto = new SpecialtyDto();
        specialtyDto.setName("radiology");
        VetDto dto = new VetDto();
        dto.setId(4);
        dto.setFirstName("James");
        dto.setLastName("Carter");
        dto.setSpecialties(List.of(specialtyDto));

        Vet vet = vetMapper.toVet(dto);

        assertThat(vet.getId()).isEqualTo(4);
        assertThat(vet.getNrOfSpecialties()).isEqualTo(1);
        assertThat(vetMapper.toVetDto(vet).getSpecialties()).extracting(SpecialtyDto::getName)
                .containsExactly("radiology");
        assertThat(vetMapper.toVetDtos(List.of(vet))).hasSize(1);
    }

    @Test
    void fieldsDtoToVet_leaves_the_id_to_the_database() {
        VetFieldsDto fields = new VetFieldsDto();
        fields.setFirstName("James");
        fields.setLastName("Carter");
        fields.setSpecialties(List.of());

        Vet vet = vetMapper.toVet(fields);

        assertThat(vet.getId()).isNull();
        assertThat(vet.getLastName()).isEqualTo("Carter");
        assertThat(vet.getSpecialties()).isEmpty();
    }

    @Test
    void userMaps_both_ways_turning_its_roles_between_a_list_and_a_set() {
        RoleDto roleDto = new RoleDto();
        roleDto.setName("OWNER_ADMIN");
        UserDto dto = new UserDto();
        dto.setUsername("john.doe");
        dto.setPassword("secret");
        dto.setEnabled(true);
        dto.setRoles(List.of(roleDto));

        User user = userMapper.toUser(dto);

        assertThat(user.getUsername()).isEqualTo("john.doe");
        assertThat(user.getEnabled()).isTrue();
        assertThat(user.getRoles()).extracting(Role::getName).containsExactly("OWNER_ADMIN");
        assertThat(userMapper.toUserDto(user).getRoles()).extracting(RoleDto::getName)
                .containsExactly("OWNER_ADMIN");
    }

    @Test
    void aUserWithoutRoles_maps_to_empty_collections_never_to_null() {
        UserDto dto = new UserDto();
        dto.setUsername("john.doe");
        dto.setRoles(null);

        User user = userMapper.toUser(dto);

        assertThat(user.getRoles()).isEmpty();

        User bare = new User();
        bare.setUsername("john.doe");
        assertThat(userMapper.toUserDto(bare).getRoles()).isEmpty();
    }

    private static Owner anOwner() {
        Owner owner = new Owner();
        owner.setFirstName("Sherlock");
        owner.setLastName("Holmes");
        owner.setAddress("Baker St 221B");
        owner.setCity("London");
        owner.setTelephone("1234567890");
        return owner;
    }

    private static Pet aPet() {
        Pet pet = new Pet();
        pet.setName("Leo");
        pet.setBirthDate(BIRTH_DATE);
        pet.setType(aPetType());
        return pet;
    }

    private static PetType aPetType() {
        PetType petType = new PetType();
        petType.setId(1);
        petType.setName("cat");
        return petType;
    }

    private static PetTypeDto aPetTypeDto() {
        PetTypeDto dto = new PetTypeDto();
        dto.setId(1);
        dto.setName("cat");
        return dto;
    }

    private static Visit aVisit(LocalDate date, String description) {
        Visit visit = new Visit();
        visit.setDate(date);
        visit.setDescription(description);
        return visit;
    }
}
