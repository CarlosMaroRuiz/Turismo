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
import type { RoomType } from "./RoomType.js";
import { decimalTransformer } from "../transformers/index.js";

/**
 * Una fila por tipo de habitación y fecha: unidades disponibles, tarifa de esa
 * noche y cierre rápido. Es la fuente de verdad de la disponibilidad del hotel.
 */
@Entity("room_inventory")
@Index("uq_room_inventory_room_date", ["roomTypeId", "date"], { unique: true })
@Index("idx_room_inventory_date", ["date"])
export class RoomInventory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "room_type_id", type: "varchar", length: 36 })
  roomTypeId: string;

  @ManyToOne("RoomType", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "room_type_id" })
  roomType: Relation<RoomType>;

  /** Fecha de la noche, "YYYY-MM-DD". */
  @Column({ type: "date" })
  date: string;

  @Column({ type: "int" })
  units: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ name: "is_closed", type: "boolean", default: false })
  isClosed: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
