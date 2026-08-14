package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayNameGeneration;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.tools.PrettyTestNames;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The same rules as {@link CreateVisitToolTest}, written hierarchically instead of flat — the
 * duplication is the point: run both and read the two trees side by side in the IDE.
 * <p>
 * create_visit is the most rule-heavy piece of backend logic here (ownership, past date, past time,
 * abuse cap, then persist), which is exactly when the flat style stops paying: each name has to
 * repeat the context it applies to. Nesting states the context once, so what is left in a test name
 * is only what makes that case different, and the runner prints the class as a specification:
 *
 * <pre>
 * create visit should
 *   fails if
 *     the pet does not exist
 *     the pet belongs to another owner
 *     ...
 *   for a valid booking
 *     save the visit
 *     ...
 * </pre>
 * <p>
 * A social unit test: PetClinicMcp is exercised for real, with only the repositories mocked — no
 * Spring context, no database, so the whole class runs in milliseconds.
 */
@ExtendWith(MockitoExtension.class)
@DisplayNameGeneration(PrettyTestNames.class)
class CreateVisitShould {
    private static final int OWNER_ID = 7;
    private static final int PET_ID = 13;

    @Mock
    OwnerRepository ownerRepository;
    @Mock
    PetRepository petRepository;
    @Mock
    VisitRepository visitRepository;

    PetClinicMcp petClinicMcp;

    // ⚠️ JUnit creates a new test class instance for each @Test, so these are never shared
    Pet rex = new Pet()
            .setName("Rex")
            .setBirthDate(LocalDate.of(2020, 1, 1));
    LocalDate nextWeek = LocalDate.now().plusWeeks(1);
    LocalTime morning = LocalTime.of(10, 30);

    @BeforeEach
    final void before() {
        petClinicMcp = new PetClinicMcp(ownerRepository, petRepository, visitRepository);
        new Owner().setId(OWNER_ID).addPet(rex);
        rex.setId(PET_ID);
        authenticateAs(OWNER_ID);
    }

    @AfterEach
    final void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    private void givenThePetExists() {
        when(petRepository.findById(PET_ID)).thenReturn(Optional.of(rex));
    }

    @Nested
    class FailsIf {
        @Test
        void thePetDoesNotExist() {
            when(petRepository.findById(PET_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> petClinicMcp.createVisit(PET_ID, nextWeek, morning, "Vaccination"))
                    .hasMessageContaining("Pet not found");
        }

        @Test
        void thePetBelongsToAnotherOwner() {
            new Owner().setId(OWNER_ID + 1).addPet(rex);
            givenThePetExists();

            assertThatThrownBy(() -> petClinicMcp.createVisit(PET_ID, nextWeek, morning, "Vaccination"))
                    .hasMessageContaining("does not belong to owner");
        }

        @Test
        void theDateIsInThePast() {
            givenThePetExists();

            assertThatThrownBy(
                    () -> petClinicMcp.createVisit(PET_ID, LocalDate.now().minusDays(1), morning, "Vaccination"))
                    .hasMessageContaining("must be today or in the future");
        }

        @Test
        void theTimeHasAlreadyPassedToday() {
            givenThePetExists();
            // today is an allowed date, but midnight has passed at every moment of the day
            assertThatThrownBy(
                    () -> petClinicMcp.createVisit(PET_ID, LocalDate.now(), LocalTime.MIDNIGHT, "Vaccination"))
                    .hasMessageContaining("Visit time must be in the future");
        }

        @Test
        void thePetAlreadyHasTheMaximumOfUpcomingVisits() {
            for (int i = 0; i < PetClinicMcp.MAX_UPCOMING_VISITS_PER_PET; i++) {
                rex.addVisit(new Visit().setDate(LocalDate.now().plusDays(i + 1)));
            }
            givenThePetExists();

            assertThatThrownBy(() -> petClinicMcp.createVisit(PET_ID, nextWeek, morning, "One too many"))
                    .hasMessageContaining("already has the maximum")
                    .hasMessageContaining(String.valueOf(PetClinicMcp.MAX_UPCOMING_VISITS_PER_PET));
        }
    }

    @Nested
    class ForAValidBooking {
        static final int NEW_VISIT_ID = 42;

        @BeforeEach
        final void before() {
            givenThePetExists();
            when(visitRepository.save(any(Visit.class)))
                    .thenAnswer(call -> call.<Visit>getArgument(0).setId(NEW_VISIT_ID));
        }

        @Test
        void saveTheVisitAsDescribed() {
            petClinicMcp.createVisit(PET_ID, nextWeek, morning, "Vaccination");

            verify(visitRepository).save(any(Visit.class));
            assertThat(rex.getVisits()).singleElement().satisfies(visit -> {
                assertThat(visit.getDate()).isEqualTo(nextWeek);
                assertThat(visit.getTime()).isEqualTo(morning);
                assertThat(visit.getDescription()).isEqualTo("Vaccination");
            });
        }

        @Test
        void linkTheVisitToThePetOnBothSides() {
            petClinicMcp.createVisit(PET_ID, nextWeek, morning, "Vaccination");

            assertThat(rex.getVisits()).singleElement()
                    .extracting(Visit::getPet)
                    .isSameAs(rex);
        }

        @Test
        void confirmWithTheIdOfTheNewVisit() {
            String confirmation = petClinicMcp.createVisit(PET_ID, nextWeek, morning, "Vaccination");

            assertThat(confirmation)
                    .contains("id=" + NEW_VISIT_ID)
                    .contains("Rex")
                    .contains(nextWeek.toString());
        }
    }

    private static void authenticateAs(int ownerId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                String.valueOf(ownerId), null, List.of(new SimpleGrantedAuthority("ROLE_MCP"))));
    }
}
