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
import { State } from "./State.entity.js";

export enum RegionType {
  MUNICIPALITY = "municipality",
  ZONE = "zone",
}

export enum RegionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

// MySQL devuelve DECIMAL como string; esto lo convierte a number
const decimalTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity("regions")
@Index("idx_regions_state_type_status", ["stateId", "type", "status"])
export class Region {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // FK obligatoria al estado (ej. Cancún -> Quintana Roo)
  @Index("idx_regions_state_id")
  @Column({ name: "state_id", type: "varchar", length: 36 })
  stateId: string;

  @ManyToOne("State", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "state_id" })
  state: Relation<State>;

  // NULL cuando es un municipio; id de un municipio cuando es una zona
  @Index("idx_regions_parent_id")
  @Column({ name: "parent_id", type: "varchar", length: 36, nullable: true })
  parentId: string | null;

  @ManyToOne("Region", { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "parent_id" })
  parent: Relation<Region> | null;

  // En MySQL el enum se define inline (sin enumName)
  @Column({ type: "enum", enum: RegionType })
  type: RegionType;

  @Column({ type: "varchar", length: 150 })
  name: string;

  // ej. "zona-hotelera-cancun"
  @Index("uq_regions_slug", { unique: true })
  @Column({ type: "varchar", length: 180 })
  slug: string;

  // En MySQL se usa "json"; no admite default literal, siempre enviar [] como mínimo
  @Column({ type: "json" })
  aliases: string[];

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

  @Column({ type: "enum", enum: RegionStatus, default: RegionStatus.ACTIVE })
  status: RegionStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}