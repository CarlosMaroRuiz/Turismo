import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import type { User } from "./User.js";

export enum UserTokenType {
  ACTIVATION = "activation",
  PASSWORD_RESET = "password_reset",
}

@Entity("user_tokens")
@Index("idx_user_tokens_user_type", ["userId", "type"])
export class UserToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "varchar", length: 36 })
  userId: string;

  @ManyToOne("User", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: Relation<User>;

  @Column({ type: "enum", enum: UserTokenType })
  type: UserTokenType;

  // Hash SHA-256 (hex = 64 caracteres). El token en claro solo viaja en el correo.
  @Index("uq_user_tokens_token_hash", { unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  // Se llena cuando el token ya se usó (un solo uso)
  @Column({ name: "used_at", type: "timestamp", nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}