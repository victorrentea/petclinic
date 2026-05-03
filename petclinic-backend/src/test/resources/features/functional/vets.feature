Feature: Vets

  Scenario: List vets shows their specialties
    Given a vet "Helen Leary" with specialties "radiology", "dentistry"
    And a vet "Linda Douglas" with specialties "surgery"
    When I GET "/api/vets"
    Then the response status is 200
    And vet "Helen Leary" has specialties "radiology", "dentistry"
    And vet "Linda Douglas" has specialties "surgery"
