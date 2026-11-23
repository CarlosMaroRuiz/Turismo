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

@Entity("package_itinerary_days")
@Index("uq_package_itinerary_day", ["packageId", "dayNumber"], { unique: true })
export class PackageItineraryDay {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "package_id", type: "varchar", length: 36 })
  packageId: string;

  @ManyToOne("Package", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "package_id" })
  package: Relation<Package>;

  // 1, 2, 3...
  @Column({ name: "day_number", type: "int" })
  dayNumber: number;

  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "text" })
  description: string;
}