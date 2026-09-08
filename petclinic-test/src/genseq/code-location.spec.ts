import {test, expect} from '@playwright/test';
import {
  METHOD_LINK_MARKER, lineOfMethod, linkedMethodLabel, methodHandle, sourcePathOf,
} from './code-location';

const CONTROLLER = `package victor.training.petclinic.rest;

public class OwnerRestController {
    @Transactional
    public ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId,
            @RequestBody VisitFieldsDto visitFieldsDto) {
        int visitId = bookVisit(petId, visitFieldsDto);
        return ResponseEntity.created(createdUri).build();
    }

    @WithSpan("book-visit")
    private int bookVisit(int petId, VisitFieldsDto visitFieldsDto) {
        visitRepository.save(visit);
        return visit.getId();
    }
}
`;

test('a class maps to its file under the module the service is named after', () => {
  expect(sourcePathOf('petclinic-backend', 'victor.training.petclinic.rest.OwnerRestController'))
    .toBe('petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java');
});

// The agent reports a nested class as Outer$Inner; only the outer one names a file.
test('a nested class maps to the file of the class that encloses it', () => {
  expect(sourcePathOf('petclinic-backend', 'victor.training.petclinic.rest.Api$Page'))
    .toBe('petclinic-backend/src/main/java/victor/training/petclinic/rest/Api.java');
});

test('finds the declaration, not the call above it', () => {
  // `int visitId = bookVisit(…)` comes first in the file; the declaration is what a
  // reader clicking the arrow wants, and landing on the call would look like a hit.
  expect(lineOfMethod(CONTROLLER, 'bookVisit')).toBe(12);
});

test('a call on a receiver is never mistaken for a declaration', () => {
  // `visitRepository.save(visit)` is the only mention of save in this file, and it is a
  // call on a field: the method belongs to the repository, and is declared over there.
  expect(lineOfMethod(CONTROLLER, 'save')).toBe(0);
});

test('a returned call is not a declaration either', () => {
  const repository = [
    'interface VetRepository {',
    '    Optional<Vet> findByIdWithoutSpecialties(int id);',
    '',
    '    default Vet getByIdOrNull(@Nullable Integer vetId) {',
    '        return findByIdWithoutSpecialties(vetId).orElseThrow();',
    '    }',
    '}',
  ].join('\n');
  expect(lineOfMethod(repository, 'getByIdOrNull')).toBe(4);
  expect(lineOfMethod(repository, 'findByIdWithoutSpecialties')).toBe(2);
});

test('a handle carries the file, the line and what it opens', () => {
  const handle = methodHandle(
    {'code.namespace': 'victor.training.petclinic.rest.OwnerRestController',
      'code.function': 'bookVisit'},
    'petclinic-backend', '/repo', (p) => (p ===
      '/repo/petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java'
      ? CONTROLLER : undefined));
  expect(handle).toBe(
    'src://petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController'
    + '.java:12{Click to open OwnerRestController.bookVisit}');
});

// An inherited method is declared in no file of this repo. The class is still where the
// reader wants to land, so the handle keeps the file and drops the line.
test('a method the file never declares still links to the file', () => {
  const handle = methodHandle(
    {'code.namespace': 'victor.training.petclinic.repository.VisitRepository',
      'code.function': 'save'},
    'petclinic-backend', '/repo', () => 'interface VisitRepository {}');
  expect(handle).toBe(
    'src://petclinic-backend/src/main/java/victor/training/petclinic/repository/'
    + 'VisitRepository.java{Click to open VisitRepository.save}');
});

test('no code attributes, no link', () => {
  expect(methodHandle({}, 'petclinic-backend', '/repo', () => CONTROLLER)).toBeUndefined();
});

// The browser spans carry no code attributes and no module of their own; so does any
// service whose sources are not laid out under its name. Both end as a plain label.
test('a class this checkout cannot show is left unlinked', () => {
  expect(methodHandle(
    {'code.namespace': 'com.example.Elsewhere', 'code.function': 'run'},
    'other-service', '/repo', () => undefined)).toBeUndefined();
});

test('the marker rides inside the link, so the whole label is the target', () => {
  expect(linkedMethodLabel('book-visit', 'src://a/B.java:3{Click to open B.b}'))
    .toBe(`[[src://a/B.java:3{Click to open B.b} book-visit ${METHOD_LINK_MARKER}]]`);
});

test('without a handle the label is exactly what it always was', () => {
  expect(linkedMethodLabel('book-visit', undefined)).toBe('book-visit');
});
