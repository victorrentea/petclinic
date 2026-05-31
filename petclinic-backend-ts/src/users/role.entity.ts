import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

/**
 * Ported from victor.training.petclinic.model.Role.
 * @Table(name = "roles", uniqueConstraints = unique(username, role))
 *
 * Role -> User is @ManyToOne joined on the 'username' column. The Java field is
 * @JsonIgnore so it must not leak into serialized output.
 */
@Entity({ name: 'roles' })
@Unique('uni_username_role', ['user', 'name'])
export class Role {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'BY DEFAULT' })
  id!: number;

  // Java: @ManyToOne @JoinColumn(name="username") @JsonIgnore
  @ManyToOne(() => User, (user) => user.roles)
  @JoinColumn({ name: 'username', referencedColumnName: 'username' })
  user?: User;

  // Java property `name` maps to DB column `role`.
  @Column({ name: 'role' })
  name?: string;
}
