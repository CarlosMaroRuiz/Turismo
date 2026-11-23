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
import type { Package } from "./Package.js";

export enum DepartureStatus {
  OPEN = "open",
  // Cierre rápido: el agente deja de ofrecer esta salida
  CLOSED = "closed",
}

// MySQL devuelve DECIMAL como string; esto lo convierte a number
const decimalTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity("package_departures")
@Index("uq_package_departure_date", ["packageId", "departureDate"], {
  unique: true,
})
@Index("idx_package_departures_date_status", ["departureDate", "status"])
export class PackageDeparture {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "package_id", type: "varchar", length: 36 })
  packageId: string;

  @ManyToOne("Package", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "package_id" })
  package: Relation<Package>;

  // TypeORM entrega las columnas "date" como string "YYYY-MM-DD"
  @Column({ name: "departure_date", type: "date" })
  departureDate: string;

  @Column({ name: "total_seats", type: "int" })
  totalSeats: number;

  // Se usa cuando existan las reservas
  @Column({ name: "sold_seats", type: "int", default: 0 })
  soldSeats: number;

  @Column({
    name: "adult_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  adultPrice: number;

  @Column({
    name: "child_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  childPrice: number | null;

  @Column({ type: "enum", enum: DepartureStatus, default: DepartureStatus.OPEN })
  status: DepartureStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}