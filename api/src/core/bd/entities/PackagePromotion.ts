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

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
}

export enum PromotionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

// MySQL devuelve DECIMAL como string; esto lo convierte a number
const decimalTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity("package_promotions")
@Index("idx_package_promotions_package_status", ["packageId", "status"])
export class PackagePromotion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "package_id", type: "varchar", length: 36 })
  packageId: string;

  @ManyToOne("Package", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "package_id" })
  package: Relation<Package>;

  // Ej. "Promo entre semana"
  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ name: "discount_type", type: "enum", enum: DiscountType })
  discountType: DiscountType;

  // 10 (%) o 500 (monto fijo en MXN)
  @Column({
    name: "discount_value",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  discountValue: number;

  // Vigencia ("YYYY-MM-DD")
  @Column({ name: "valid_from", type: "date" })
  validFrom: string;

  @Column({ name: "valid_to", type: "date" })
  validTo: string;

  // Condición opcional: mínimo de personas
  @Column({ name: "min_travelers", type: "int", nullable: true })
  minTravelers: number | null;

  // Condición opcional: días de salida válidos (0=domingo ... 6=sábado), ej. [1,2,3,4]
  @Column({ name: "days_of_week", type: "json", nullable: true })
  daysOfWeek: number[] | null;

  @Column({
    type: "enum",
    enum: PromotionStatus,
    default: PromotionStatus.ACTIVE,
  })
  status: PromotionStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}