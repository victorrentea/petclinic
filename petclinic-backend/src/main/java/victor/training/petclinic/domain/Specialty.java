package victor.training.petclinic.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "specialties")
@Getter
@Setter
public class Specialty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    private String name;

    /** The section that identifies this specialty (symptoms); vectorized into the chatbot RAG. */
    private String description;

}
