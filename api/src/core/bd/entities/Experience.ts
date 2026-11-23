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
import type { Region } from "./Region.entity.js";
import { decimalTransformer } from "../transformers/index.js";

/**
 * Experiencia de un operador de atractivos (tour, parque, cenote, museo...).
 * La disponibilidad real vive en `experience_slots` (turno por fecha y hora).
 */
@Entity("experiences")
@Index("idx_experiences_partner_active", ["partnerId", "isActive"])
@Index("idx_experiences_region_active", ["regionId", "isActive"])
export class Experience {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "partner_id", type: "varchar", length: 36 })
  partnerId: string;

  @ManyToOne("Partner", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "partner_id" })
  partner: Relation<Partner>;

  @Column({ name: "region_id", type: "varchar", length: 36 })
  regionId: string;

  @ManyToOne("Region", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "region_id" })
  region: Relation<Region>;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Index("uq_experiences_slug", { unique: true })
  @Column({ type: "varchar", length: 180 })
  slug: string;

  @Column({ type: "text" })
  description: string;

  @Column({ name: "duration_minutes", type: "int" })
  durationMinutes: number;

  @Column({ name: "min_age", type: "int", nullable: true })
  minAge: number | null;

  @Column({
    name: "price_adult",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  priceAdult: number;

  @Column({
    name: "price_child",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceChild: number | null;

  @Column({ type: "text", nullable: true })
  requirements: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
