import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

/**
 * Role entity, mapped to the "roles" table with a unique (username, role).
 *
 * Role -> User is a many-to-one joined on the 'username' column. The `user`
 * field must not leak into serialized output.
 */
@Entity({ name: 'roles' })
@Unique('uni_username_role', ['user', 'name'])
export class Role {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  @ManyToOne(() => User, (user) => user.roles)
  @JoinColumn({ name: 'username', referencedColumnName: 'username' })
  user?: User;

  // The `name` property maps to the DB column `role`.
  @Column({ name: 'role' })
  name?: string;
}
