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
import { decimalTransformer } from "../transformers/index.js";

/**
 * Tipo de habitación de un hotel (doble, suite, familiar...).
 * El inventario por fecha vive en `room_inventory`; si no hay fila para una
 * fecha se usa `totalUnits` y `basePrice` como valores por defecto.
 */
@Entity("room_types")
@Index("idx_room_types_partner_active", ["partnerId", "isActive"])
export class RoomType {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "partner_id", type: "varchar", length: 36 })
  partnerId: string;

  @ManyToOne("Partner", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "partner_id" })
  partner: Relation<Partner>;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "max_adults", type: "int", default: 2 })
  maxAdults: number;

  @Column({ name: "max_children", type: "int", default: 0 })
  maxChildren: number;

  @Column({ name: "total_units", type: "int", default: 1 })
  totalUnits: number;

  @Column({
    name: "base_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  basePrice: number;

  @Column({ type: "json" })
  amenities: string[];

  // Galería: URLs de imágenes de la habitación.
  @Column({ type: "json" })
  images: string[];

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
