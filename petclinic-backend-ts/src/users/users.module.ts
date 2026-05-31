import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { User } from './user.entity';
import { UserController } from './user.controller';

/**
 * Feature module for the USERS domain, ported from the Java backend.
 *
 * Mirrors the Java design: NO service layer — the controller injects the
 * TypeORM repositories directly. Registers User + Role so their repositories
 * are injectable and so the User -> Role cascade (Java @OneToMany(cascade=ALL))
 * has both entities' metadata available.
 *
 * The mappers (user.mapper.ts) are stateless plain functions imported directly
 * by the controller, so they are intentionally NOT declared as providers.
 *
 * The root app.module.ts (Integration phase) imports this module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  controllers: [UserController],
})
export class UsersModule {}
