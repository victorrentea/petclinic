package victor.training.petclinic;

import org.springframework.test.context.jdbc.Sql;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The test starts on the Default dataset — the demo seed the app boots with
 * ({@code db/seed/R__seed.sql}: owner 1 = Kevin McCallister, pet 3 = Milton, the six vets, the
 * admin user) — instead of the empty database every Spring test gets
 * ({@code src/test/resources/config/application.properties}).
 *
 * <p>Put it on a test that reads a row it did not write. On the class it covers every method; on
 * a method, only that one. It loads the seed before the test, inside the test's transaction when
 * there is one (so it rolls back with it); Zonky hands the next test a fresh database either way.
 *
 * <p>Declared, not inherited from configuration, so what a test starts on is written on the test
 * itself — where a reader, and the review page's DB fixture dot, can see it.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Sql("classpath:db/seed/R__seed.sql")
public @interface DefaultFixture {
}
