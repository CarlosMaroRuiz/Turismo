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

/**
 * Refresh token persistido: solo se guarda su hash SHA-256.
 * Rotación: al renovar se revoca el anterior y se emite uno nuevo.
 */
@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("idx_refresh_tokens_user_id")
  @Column({ name: "user_id", type: "varchar", length: 36 })
  userId: string;

  @ManyToOne("User", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: Relation<User>;

  @Index("uq_refresh_tokens_token_hash", { unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamp", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "user_agent", type: "varchar", length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}
