import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Role } from './role.entity';

/**
 * Ported from victor.training.petclinic.model.User.
 * @Table(name = "users")
 *
 * PK is `username` (a plain string, NOT generated).
 * Roles: @OneToMany(cascade = ALL, mappedBy = "user", fetch = EAGER).
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  username!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  password?: string;

  @Column({ type: 'boolean', nullable: true })
  enabled?: boolean;

  // Java: @OneToMany(cascade = ALL, mappedBy = "user", fetch = EAGER)
  @OneToMany(() => Role, (role) => role.user, { cascade: true, eager: true })
  roles?: Role[];

  /**
   * Mirrors Java User.addRole(String): lazily initializes the role set and
   * appends a new Role with the given name.
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
