package victor.training.petclinic.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

/** One bookable appointment window of a vet, claimed by at most one {@link Visit}. */
@Entity
@Table(name = "time_slots")
public class TimeSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    @NotNull
    @ManyToOne
    @JoinColumn(name = "vet_id")
    private Vet vet;

    @NotNull
    @Column(name = "slot_date", columnDefinition = "DATE")
    private LocalDate date;

    @NotNull
    @Column(name = "start_time", columnDefinition = "TIME")
    private LocalTime startTime;

    @NotNull
    @Column(name = "end_time", columnDefinition = "TIME")
    private LocalTime endTime;

    public TimeSlot() {
    }

    public TimeSlot(Vet vet, LocalDate date, LocalTime startTime, LocalTime endTime) {
        this.vet = vet;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Vet getVet() {
        return vet;
    }

    public void setVet(Vet vet) {
        this.vet = vet;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }
}
