package victor.training.petclinic.domain;

import jakarta.persistence.*;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "visits")
public class Visit {
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

    /** A visit is dated between the pet's birth and one year from today. */
    public void requireDateWithinRange() {
        if (date == null) {
            return;
        }
        LocalDate birthDate = pet.getBirthDate();
        if (birthDate != null && date.isBefore(birthDate)) {
            throw new ValidationException(
                    "The visit (" + date + ") cannot predate the pet's birth (" + birthDate + ")");
        }
        LocalDate latestDate = LocalDate.now().plusYears(1);
        if (date.isAfter(latestDate)) {
            throw new ValidationException(
                    "The visit (" + date + ") cannot be more than one year ahead (" + latestDate + ")");
        }
    }
}
