package victor.training.petclinic.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "visits")
public class Visit {
    /** Bug #40: a visit may not be booked further ahead than this. */
    public static final int MAX_YEARS_AHEAD = 1;

    /**
     * Bug #40: a visit date may neither predate the pet nor sit far in the future.
     * The frontend applies the same bounds to its datepicker; this is the enforcement.
     */
    public static void validateDate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            return; // absence of a date is a separate concern
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw new IllegalArgumentException(
                    "Visit date " + visitDate + " is before the pet was born (" + petBirthDate + ")");
        }
        LocalDate latest = LocalDate.now().plusYears(MAX_YEARS_AHEAD);
        if (visitDate.isAfter(latest)) {
            throw new IllegalArgumentException(
                    "Visit date " + visitDate + " is more than " + MAX_YEARS_AHEAD
                            + " year ahead (after " + latest + ")");
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    @Column(name = "visit_date", columnDefinition = "DATE")
    private LocalDate date = LocalDate.now();

    /** Exact local time of the appointment; null on legacy rows created before V4. */
    @Column(name = "visit_time", columnDefinition = "TIME")
    private LocalTime time;

    @NotEmpty
    private String description;

    @ManyToOne
    @JoinColumn(name = "pet_id")
    private Pet pet;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getTime() {
        return time;
    }

    public void setTime(LocalTime time) {
        this.time = time;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Pet getPet() {
        return pet;
    }

    public void setPet(Pet pet) {
        this.pet = pet;
    }
}
