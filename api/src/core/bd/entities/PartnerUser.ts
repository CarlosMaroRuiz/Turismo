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
import type { Partner } from "./Partner.js";
import type { User } from "./User.js";

// Rol interno dentro de un socio (no es el rol global de la tabla "roles")
export enum PartnerUserRole {
  OWNER = "owner",
  STAFF = "staff",
}

@Entity("partner_users")
@Index("uq_partner_users_partner_user", ["partnerId", "userId"], {
  unique: true,
})
export class PartnerUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("idx_partner_users_partner_id")
  @Column({ name: "partner_id", type: "varchar", length: 36 })
  partnerId: string;

  @ManyToOne("Partner", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "partner_id" })
  partner: Relation<Partner>;

  @Index("idx_partner_users_user_id")
  @Column({ name: "user_id", type: "varchar", length: 36 })
  userId: string;

  @ManyToOne("User", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "user_id" })
  user: Relation<User>;

  @Column({
    type: "enum",
    enum: PartnerUserRole,
    default: PartnerUserRole.STAFF,
  })
  role: PartnerUserRole;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}