package org.springframework.samples.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Review;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends Repository<Review, Integer> {

    @Query("SELECT r FROM Review r WHERE r.vet.id = :vetId ORDER BY r.createdAt DESC")
    List<Review> findByVetIdOrderByCreatedAtDesc(@Param("vetId") int vetId);

    @Query("SELECT r FROM Review r WHERE r.vet.id = :vetId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<Review> findMostRecentByVetId(@Param("vetId") int vetId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.vet.id = :vetId")
    Double findAverageRatingByVetId(@Param("vetId") int vetId);

    @Query("SELECT COALESCE(COUNT(r), 0) FROM Review r WHERE r.vet.id = :vetId")
    Long countByVetId(@Param("vetId") int vetId);

    Optional<Review> findById(int id);

    void save(Review review);

    void delete(Review review);


    @Query("SELECT r.vet.id, AVG(r.rating), COUNT(r) FROM Review r GROUP BY r.vet.id")
    List<Object[]> findAllReviewStats();


}
