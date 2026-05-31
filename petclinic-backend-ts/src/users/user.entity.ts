import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Role } from './role.entity';

/**
 * User entity, mapped to the "users" table.
 *
 * PK is `username` (a plain string, NOT generated).
 * Roles are a one-to-many with cascade-all and eager loading.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  username!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  password?: string;

  @Column({ type: 'boolean', nullable: true })
  enabled?: boolean;

  @OneToMany(() => Role, (role) => role.user, { cascade: true, eager: true })
  roles?: Role[];

  /**
   * Lazily initializes the role list and appends a new Role with the given name.
   */
  addRole(roleName: string): void {
    if (!this.roles) {
      this.roles = [];
    }
    const role = new Role();
    role.name = roleName;
    this.roles.push(role);
  }
}
