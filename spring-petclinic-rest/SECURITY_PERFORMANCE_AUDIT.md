# Security & Performance Audit Report
**Date:** February 10, 2026  
**Project:** Spring PetClinic REST API

---

## Executive Summary

### ✅ Positive Findings
- No known CVEs in dependencies
- BCrypt password hashing enabled
- Method-level security with @PreAuthorize
- Clean database health (no bloat, invalid indexes, or wraparound issues)

### ⚠️ Critical Issues (4)
1. **CSRF disabled globally** - high security risk
2. **configureGlobal() method not invoked** - authentication broken
3. **EAGER fetching** causing N+1 queries (3 entities)
4. **Hardcoded CORS origin** - production risk

### 🔶 Medium Priority Issues (5)
5. Password storage in User entity accessible
6. No pagination on list endpoints
7. CORS allows all headers
8. Exception handler exposes stack traces
9. HTTP Basic Auth over non-HTTPS

### 📊 Low Priority Issues (3)
10. Unused database indexes
11. Index cache hit rate: 94.7% (below 95%)
12. Missing input sanitization

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. CSRF Protection Disabled
**Location:** `BasicAuthenticationConfig.java:37`, `DisableSecurityConfig.java:23`
```java
.csrf(AbstractHttpConfigurer::disable)
```
**Risk:** Cross-Site Request Forgery attacks possible
**Impact:** Attackers can execute unauthorized actions on behalf of authenticated users
**Recommendation:** 
- Enable CSRF for state-changing operations (POST, PUT, DELETE)
- Use CSRF tokens for web clients
- If API-only, consider using stateless JWT instead of Basic Auth

---

### 2. Authentication Not Configured
**Location:** `BasicAuthenticationConfig.java:45-53`
```java
public void configureGlobal(AuthenticationManagerBuilder auth) throws Exception {
    // @Autowired missing - method never invoked!
```
**Risk:** JDBC authentication config is dead code
**Impact:** Authentication might not work as expected when `petclinic.security.enable=true`
**Recommendation:**
```java
@Autowired
public void configureGlobal(AuthenticationManagerBuilder auth) throws Exception {
```

---

### 3. Performance: EAGER Fetching (N+1 Queries)
**Locations:**
- `Owner.java:43` - `@OneToMany(fetch = FetchType.EAGER)` for pets
- `Pet.java:34` - `@OneToMany(fetch = FetchType.EAGER)` for visits  
- `User.java:23` - `@OneToMany(fetch = FetchType.EAGER)` for roles

**Risk:** Performance degradation with data growth
**Impact:** Each owner query triggers additional queries for pets and visits
**Example:** Listing 100 owners = 1 + 100 + N queries

**Recommendation:** Change to LAZY and use JOIN FETCH where needed:
```java
@OneToMany(cascade = CascadeType.ALL, mappedBy = "owner")
private Set<Pet> pets = new HashSet<>();

// In repository
@Query("SELECT DISTINCT o FROM Owner o LEFT JOIN FETCH o.pets")
List<Owner> findAll();
```

**Good Example Already Present:** `VetRepository` uses JOIN FETCH correctly

---

### 4. Hardcoded CORS Origin
**Location:** `CorsConfig.java:12`
```java
.allowedOrigins("http://localhost:4200")
```
**Risk:** Won't work in production; might accidentally allow wrong origins
**Recommendation:**
```java
@Value("${cors.allowed-origins:http://localhost:4200}")
private String allowedOrigins;

registry.addMapping("/**")
    .allowedOrigins(allowedOrigins.split(","))
```

---

## 🟠 MEDIUM PRIORITY ISSUES

### 5. Password Field Accessible in User Entity
**Location:** `User.java:19`
```java
private String password; // No @JsonIgnore
```
**Risk:** Password hash might be exposed in responses
**Recommendation:**
```java
@JsonIgnore
private String password;
```

---

### 6. No Pagination on List Endpoints
**Locations:** All list endpoints (owners, pets, vets, visits)
**Risk:** Performance issues with large datasets; potential DoS
**Example:** `GET /api/pets` returns ALL pets
**Recommendation:**
```java
@GetMapping
public Page<PetDto> listPets(Pageable pageable) {
    Page<Pet> page = petRepository.findAll(pageable);
    return page.map(petMapper::toPetDto);
}
```

---

### 7. CORS Allows All Headers
**Location:** `CorsConfig.java:14`
```java
.allowedHeaders("*")
```
**Risk:** Too permissive
**Recommendation:** Explicitly list allowed headers:
```java
.allowedHeaders("Content-Type", "Authorization", "X-Requested-With")
```

---

### 8. Exception Handler Exposes Internal Details
**Location:** `ExceptionControllerAdvice.java:65-70`
```java
public ResponseEntity<ProblemDetail> handleGeneralException(Exception e, HttpServletRequest request) {
    log.error("An unexpected error occurred: {}", e.getMessage(), e);
    ProblemDetail pd = buildProblemDetail(e.getMessage(),
        e.getMessage(), // ⚠️ Exposes exception message to client
```
**Risk:** Information disclosure (stack traces, SQL errors, internal paths)
**Recommendation:**
```java
ProblemDetail pd = buildProblemDetail("Internal Server Error",
    "An unexpected error occurred. Please contact support.",
    HttpStatus.INTERNAL_SERVER_ERROR, request);
```

---

### 9. HTTP Basic Auth Over Non-HTTPS
**Risk:** Credentials sent in Base64 (easily decoded)
**Recommendation:**
- Enforce HTTPS in production
- Consider OAuth2/JWT for better security
- Add in `application.properties`:
```properties
server.ssl.enabled=true
security.require-ssl=true
```

---

## 📘 LOW PRIORITY ISSUES

### 10. Unused Database Indexes
**From DB Health Check:**
```
Index 'owners_last_name_idx' - 0 scans
Index 'pets_name_idx' - 0 scans
Index 'vets_last_name_idx' - 0 scans
```
**Impact:** Minimal (small dataset), but wastes space
**Recommendation:** Keep for production; normal for dev/test environments

---

### 11. Index Cache Hit Rate Below Threshold
**Metric:** 94.7% (target: 95%+)
**Impact:** Slight performance inefficiency
**Recommendation:** Acceptable for development; monitor in production

---

### 12. Missing Input Sanitization
**Example:** `OwnerRestController.java:50`
```java
public List<OwnerDto> listOwners(@RequestParam(name = "lastName", required = false) String lastName) {
    // No sanitization of lastName parameter
```
**Risk:** Potential injection if query building changes
**Current Status:** Safe (using Spring Data query methods)
**Recommendation:** Add validation if switching to native queries

---

## 🔒 SECURITY BEST PRACTICES - COMPLIANCE

| Practice | Status | Notes |
|----------|--------|-------|
| Input validation | ✅ Good | Using `@Validated`, `@NotNull`, etc. |
| Password hashing | ✅ Good | BCrypt with default strength (10) |
| SQL injection protection | ✅ Good | Using JPA/Spring Data |
| Authentication | ⚠️ Broken | `configureGlobal()` not invoked |
| Authorization | ✅ Good | `@PreAuthorize` on controllers |
| CORS configuration | ⚠️ Too permissive | Hardcoded origin, all headers |
| CSRF protection | ❌ Disabled | Major security gap |
| HTTPS enforcement | ❌ Not configured | Credentials sent in clear |
| Error handling | ⚠️ Info leak | Exception messages exposed |
| Logging | ✅ Good | No sensitive data logged |

---

## ⚡ PERFORMANCE ANALYSIS

### Current State
- **Good:**
  - `spring.jpa.open-in-view=false` (no lazy loading issues)
  - VetRepository uses JOIN FETCH correctly
  - No database health issues
  
- **Bad:**
  - EAGER fetching on 3 entities → N+1 queries
  - No pagination → unbounded result sets
  - No caching configured (Spring Cache, Redis)

### Load Testing Recommendations
1. Use JMeter tests in `/test/jmeter/`
2. Monitor with Spring Boot Actuator metrics
3. Add query logging: `spring.jpa.show-sql=true` (already enabled)
4. Consider adding Micrometer + Prometheus for production

---

## 📋 ACTION ITEMS (Priority Order)

### Must Fix Before Production
1. ✅ Fix `configureGlobal()` authentication
2. ✅ Enable CSRF protection or switch to JWT
3. ✅ Change EAGER to LAZY fetch + JOIN FETCH
4. ✅ Externalize CORS configuration
5. ✅ Add `@JsonIgnore` to User.password

### Should Fix Soon
6. ✅ Add pagination to list endpoints
7. ✅ Sanitize exception messages
8. ✅ Restrict CORS headers
9. ✅ Enforce HTTPS in production

### Nice to Have
10. ✅ Add caching (Spring Cache)
11. ✅ Add rate limiting
12. ✅ Implement API versioning
13. ✅ Add health check endpoints (already has Actuator)

---

## 📚 REFERENCES

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [Spring Data JPA Performance](https://www.baeldung.com/spring-data-jpa-query)
- [REST API Security Checklist](https://github.com/shieldfy/API-Security-Checklist)

---

## 🔍 SCAN METHODOLOGY

1. **Dependency CVE scan** - Maven dependencies checked against NVD
2. **Code analysis** - Security configs, REST controllers, JPA entities
3. **Database health** - PostgreSQL health check via MCP
4. **Static code review** - Authentication, authorization, input validation
5. **Performance patterns** - N+1 queries, fetch strategies, pagination

**Tools Used:** GitHub Copilot static analysis, PostgreSQL health checks, Maven dependency validation

