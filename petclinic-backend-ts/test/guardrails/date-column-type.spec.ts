/**
 * Date-column type guardrail (parser-level, no regex).
 *
 * Parses TypeScript sources with the TypeScript compiler API and flags any
 * `@Entity` class property whose `@Column` is a `date` column but whose
 * declared TS type is `string` — those must be typed `Date`.
 */
import { findDateStringViolations } from './date-column-type';

function violationsOf(source: string) {
  return findDateStringViolations(source, 'fixture.entity.ts');
}

describe('date-column-type guardrail', () => {
  it('flags a date column typed string', () => {
    const violations = violationsOf(`
      @Entity({ name: 'visits' })
      export class Visit {
        @Column({ name: 'visit_date', type: 'date', nullable: true })
        date?: string;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({ className: 'Visit', property: 'date', line: 5 }),
    ]);
  });

  it('flags the @Column(type) shorthand form', () => {
    const violations = violationsOf(`
      @Entity()
      export class Visit {
        @Column('date')
        date: string;
      }
    `);

    expect(violations).toHaveLength(1);
  });

  it('flags a string union type', () => {
    const violations = violationsOf(`
      @Entity()
      export class Visit {
        @Column({ type: 'date' })
        date: string | null;
      }
    `);

    expect(violations).toHaveLength(1);
  });

  it('accepts a date column typed Date', () => {
    const violations = violationsOf(`
      @Entity()
      export class Visit {
        @Column({ type: 'date' })
        date?: Date;
      }
    `);

    expect(violations).toHaveLength(0);
  });

  it('accepts string properties on non-date columns', () => {
    const violations = violationsOf(`
      @Entity()
      export class Visit {
        @Column({ type: 'text', nullable: true })
        description?: string;
      }
    `);

    expect(violations).toHaveLength(0);
  });

  it('ignores classes without @Entity', () => {
    const violations = violationsOf(`
      export class VisitDto {
        @Column({ type: 'date' })
        date?: string;
      }
    `);

    expect(violations).toHaveLength(0);
  });
});
