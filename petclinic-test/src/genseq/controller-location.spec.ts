import {expect, test} from '@playwright/test';
import type {NormSpan} from './trace-to-puml';
import {handlerHandle, moduleHandlers, routeOf} from './controller-location';

// A request's arrow opens the controller method it landed on, resolved by its route against
// the service's sources: the trace carries the route and no code.

const OWNERS = `package victor.training.petclinic.rest;

@RestController
@RequestMapping("/api/owners")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {

    @Operation(operationId = "listOwners", summary = "List owners")
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = OwnerDto.class))))
    @GetMapping(produces = "application/json")
    public List<OwnerDto> listOwners(@RequestParam String lastName) {
        return null;
    }

    @GetMapping("/{ownerId}")
    public OwnerDto getOwner(@PathVariable int ownerId) {
        return null;
    }

    @PostMapping("{ownerId}/pets/{petId}/visits")
    public ResponseEntity<VisitDto> addVisitToOwner(@PathVariable int ownerId) {
        return null;
    }

    @RequestMapping(value = "/legacy", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public void legacy() {
    }
}
`;

const NOTIFICATIONS = `package victor.training.notification;

@RestController
public class NotificationController {
    @PostMapping(VisitBookedNotification.PATH)
    public void visitBooked(@RequestBody VisitBookedNotification n) {
    }
}
`;

// The shared constant lives in a library linked into both the service and its client.
const SHARED = `package victor.training.commons;
public record VisitBookedNotification(String phone) {
    public static final String PATH = "/api/notifications/visit-booked";
}
`;

const REPO = '/repo';
const JAVA = (module: string) => `${REPO}/${module}/src/main/java/victor/training`;
const files: Record<string, string> = {
  [`${JAVA('petclinic-backend')}/petclinic/rest/OwnerRestController.java`]: OWNERS,
  [`${JAVA('notification-service')}/notification/NotificationController.java`]: NOTIFICATIONS,
  [`${JAVA('petclinic-commons')}/commons/VisitBookedNotification.java`]: SHARED,
};
const read = (p: string) => files[p];
const walk = (dir: string) => Object.keys(files).filter((f) => f.startsWith(`${dir}/`));
const lineOf = (source: string, needle: string) =>
  source.split('\n').findIndex((l) => l.includes(needle)) + 1;

test('a method mapping joins its class’s base path, past every annotation between them', () => {
  const handlers = moduleHandlers('petclinic-backend', REPO, read, walk);
  const file = 'petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java';
  expect(handlers.get('GET /api/owners')).toEqual(
    {file, line: lineOf(OWNERS, 'listOwners(@'), name: 'OwnerRestController.listOwners'});
  expect(handlers.get('GET /api/owners/{ownerId}')?.name).toBe('OwnerRestController.getOwner');
  expect(handlers.get('POST /api/owners/{ownerId}/pets/{petId}/visits')?.line)
    .toBe(lineOf(OWNERS, 'addVisitToOwner('));
  expect(handlers.get('PUT /api/owners/legacy')?.name).toBe('OwnerRestController.legacy');
  expect(handlers.get('PATCH /api/owners/legacy')?.name).toBe('OwnerRestController.legacy');
});

test('a route named by a constant in a shared library resolves', () => {
  const handlers = moduleHandlers('notification-service', REPO, read, walk);
  expect(handlers.get('POST /api/notifications/visit-booked')?.name)
    .toBe('NotificationController.visitBooked');
});

const server = (attributes: Record<string, string>, name = 'GET /api/owners/{ownerId}'): NormSpan => ({
  traceId: 't', spanId: 's', parentSpanId: 'c', name, kind: 'SERVER',
  serviceName: 'petclinic-backend', startNano: 0, attributes,
});

test('the route comes from the span’s attributes, else from its name', () => {
  expect(routeOf(server({'http.request.method': 'GET', 'http.route': '/api/owners/{ownerId}'})))
    .toBe('GET /api/owners/{ownerId}');
  expect(routeOf(server({}))).toBe('GET /api/owners/{ownerId}');
  expect(routeOf(server({}, 'GET'))).toBeUndefined();
});

test('the handle opens the declaration and says which method it is', () => {
  const handlers = moduleHandlers('petclinic-backend', REPO, read, walk);
  expect(handlerHandle(server({}), handlers)).toBe(
    'src://petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:'
    + `${lineOf(OWNERS, 'getOwner(@')}{Click to open OwnerRestController.getOwner}`);
  expect(handlerHandle(server({}, 'GET /api/nowhere'), handlers)).toBeUndefined();
  expect(handlerHandle({...server({}), kind: 'CLIENT'}, handlers)).toBeUndefined();
});
