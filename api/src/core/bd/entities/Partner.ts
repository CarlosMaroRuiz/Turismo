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
import type { PartnerCategory } from "./PartnerCategory.js";
import type { Region } from "./Region.entity.js";

export enum PartnerStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  REJECTED = "rejected",
}

// MySQL devuelve DECIMAL como string; esto lo convierte a number
const decimalTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity("partners")
@Index("idx_partners_region_status", ["regionId", "status"])
@Index("idx_partners_category_status", ["categoryId", "status"])
export class Partner {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Hotel, agencia u operador de atractivos
  @Column({ name: "category_id", type: "varchar", length: 36 })
  categoryId: string;

  @ManyToOne("PartnerCategory", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "category_id" })
  category: Relation<PartnerCategory>;

  // Región (municipio o zona) donde opera; el agente filtra por este campo
  @Column({ name: "region_id", type: "varchar", length: 36 })
  regionId: string;

  @ManyToOne("Region", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "region_id" })
  region: Relation<Region>;

  @Column({ name: "commercial_name", type: "varchar", length: 150 })
  commercialName: string;

  @Column({ name: "legal_name", type: "varchar", length: 200 })
  legalName: string;

  @Index("uq_partners_slug", { unique: true })
  @Column({ type: "varchar", length: 180 })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 255 })
  address: string;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  lat: number | null;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  lng: number | null;

  @Column({ name: "contact_name", type: "varchar", length: 150 })
  contactName: string;

  @Column({ name: "contact_email", type: "varchar", length: 150 })
  contactEmail: string;

  @Column({ name: "contact_phone", type: "varchar", length: 30 })
  contactPhone: string;

  // Solo "active" es visible para el agente
  @Column({
    type: "enum",
    enum: PartnerStatus,
    default: PartnerStatus.PENDING,
  })
  status: PartnerStatus;

  // Motivo de rechazo o suspensión
  @Column({
    name: "status_reason",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  statusReason: string | null;

  @Column({ name: "approved_at", type: "timestamp", nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}