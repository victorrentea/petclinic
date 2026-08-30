package victor.training.petclinic.domain;

import jakarta.persistence.*;
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

    /** The vet who will see the pet; null on visits booked before slots existed. */
    @ManyToOne
    @JoinColumn(name = "vet_id")
    private Vet vet;

    /** The slot this visit claims. Unique in the schema, so a slot holds at most one visit. */
    @OneToOne
    @JoinColumn(name = "time_slot_id")
    private TimeSlot timeSlot;

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

    public Vet getVet() {
        return vet;
    }

    public void setVet(Vet vet) {
        this.vet = vet;
    }

    public TimeSlot getTimeSlot() {
        return timeSlot;
    }

    public void setTimeSlot(TimeSlot timeSlot) {
        this.timeSlot = timeSlot;
    }
}
