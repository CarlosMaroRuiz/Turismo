import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import type { Package } from "./Package.js";

export enum PackageItemType {
  LODGING = "lodging",
  TRANSPORT = "transport",
  MEALS = "meals",
  ACTIVITY = "activity",
  OTHER = "other",
}

@Entity("package_items")
export class PackageItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("idx_package_items_package_id")
  @Column({ name: "package_id", type: "varchar", length: 36 })
  packageId: string;

  @ManyToOne("Package", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "package_id" })
  package: Relation<Package>;

  // Para que la IA agrupe la respuesta (hospedaje, traslados, comidas...)
  @Column({ type: "enum", enum: PackageItemType })
  type: PackageItemType;

  // Ej. "Hotel 3 estrellas, 3 noches"
  @Column({ type: "varchar", length: 255 })
  description: string;

  // true = incluye, false = no incluye
  @Column({ name: "is_included", type: "boolean", default: true })
  isIncluded: boolean;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;
}