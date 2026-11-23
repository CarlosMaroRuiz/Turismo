import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import type { Role } from "./Role.js";

export enum UserStatus {
  // Creado por el super_user, aún no define su contraseña (no puede iniciar sesión)
  INVITED = "invited",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("idx_users_role_id")
  @Column({ name: "role_id", type: "varchar", length: 36 })
  roleId: string;

  @ManyToOne("Role", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "role_id" })
  role: Relation<Role>;

  @Column({ type: "varchar", length: 150 })
  name: string;

  // Es el login
  @Index("uq_users_email", { unique: true })
  @Column({ type: "varchar", length: 150 })
  email: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone: string | null;

  // NULL mientras el usuario está "invited" (aún no activa su cuenta).
  // select: false evita devolver el hash en consultas normales;
  // en el login hay que pedirlo con addSelect("user.passwordHash").
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.INVITED })
  status: UserStatus;

  // Útil para el super_user sembrado desde .env
  @Column({ name: "must_change_password", type: "boolean", default: false })
  mustChangePassword: boolean;

  // Se incrementa al revocar sesiones (logout global, cambio de contraseña,
  // suspensión). Un access token con versión distinta deja de valer.
  @Column({ name: "token_version", type: "int", default: 0 })
  tokenVersion: number;

  @Column({ name: "last_login_at", type: "timestamp", nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}