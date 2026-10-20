import {test, expect} from '@playwright/test';
import {
  METHOD_LINK_MARKER, lineOfMethod, linkedMethodLabel, methodHandle, overloadOf, sourcePathOf,
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

// petclinic-commons is linked into both services, so a span opened inside it carries the
// service that loaded it — and its class lives under neither service's folder.
test('a class from the shared library links into the library, whichever service ran it', () => {
  const handle = methodHandle(
    {'code.namespace': 'victor.training.commons.PhoneNumbers', 'code.function': 'normalize'},
    'notification-service', '/repo', (p) => (p ===
      '/repo/petclinic-commons/src/main/java/victor/training/commons/PhoneNumbers.java'
      ? 'class PhoneNumbers {\n  static String normalize(String phone) {' : undefined));
  expect(handle).toBe('src://petclinic-commons/src/main/java/victor/training/commons/PhoneNumbers'
    + '.java:2{Click to open PhoneNumbers.normalize}');
});

// Two methods named `normalize`: the javadoc of the second even names the first, and the
// second calls the first. Each arrow has to open the overload it drew.
const PHONE_NUMBERS = `package victor.training.commons;

public final class PhoneNumbers {
    /** {@code +1 (608) 555-1023} → {@code +16085551023}. */
    public static String normalize(String phone) {
        return phone;
    }

    /** Like {@link #normalize(String)}, but a national number is given the caller's dial code. */
    public static String normalize(String phone,
            HomeCountry homeCountry) {
        String normalized = normalize(phone);
        return homeCountry.homeDialCode() + normalized;
    }
}
`;
const PHONE_NUMBERS_PATH =
  '/repo/petclinic-commons/src/main/java/victor/training/commons/PhoneNumbers.java';
const phoneHandle = (attributes: Record<string, string>) => methodHandle(
  {'code.namespace': 'victor.training.commons.PhoneNumbers', 'code.function': 'normalize',
    ...attributes},
  'petclinic-backend', '/repo', (p) => (p === PHONE_NUMBERS_PATH ? PHONE_NUMBERS : undefined));

test('an overload is found by the parameter types the span was stamped with', () => {
  expect(phoneHandle({'boundary.parameters': 'String, HomeCountry'})).toContain('PhoneNumbers.java:10{');
  expect(phoneHandle({'boundary.parameters': 'String'})).toContain('PhoneNumbers.java:5{');
});

// A span recorded before the types were stamped still printed its arguments.
test('without stamped types, the number of arguments picks the overload', () => {
  expect(phoneHandle({'boundary.args': '[8474461990, victor.training.X@64fb61b]'}))
    .toContain('PhoneNumbers.java:10{');
  expect(phoneHandle({'boundary.args': '[+18474461990]'})).toContain('PhoneNumbers.java:5{');
});

test('with nothing to tell overloads apart, the first one by name is the answer', () => {
  expect(phoneHandle({})).toContain('PhoneNumbers.java:5{');
});

test('a record or a list among the arguments counts as one', () => {
  expect(overloadOf({'boundary.args': '[Owner[id=1, name=x], [a, b], 3]'})).toEqual({arity: 3});
  expect(overloadOf({'boundary.args': '[]'})).toEqual({arity: 0});
});

test('parameter types are compared erased and unqualified, annotations ignored', () => {
  const source = [
    'class C {',
    '  void put(int id) {}',
    '  void put(@RequestBody final java.util.Map<String, List<Integer>> byId, String... rest) {}',
    '}',
  ].join('\n');
  expect(lineOfMethod(source, 'put', {types: ['Map', 'String[]']})).toBe(3);
  expect(lineOfMethod(source, 'put', {types: ['int']})).toBe(2);
});
