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

export enum PackageStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  PAUSED = "paused",
}

@Entity("packages")
@Index("idx_packages_partner_status", ["partnerId", "status"])
@Index("idx_packages_destination_status", ["destinationRegionId", "status"])
export class Package {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Agencia dueña del paquete
  @Column({ name: "partner_id", type: "varchar", length: 36 })
  partnerId: string;

  @ManyToOne("Partner", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "partner_id" })
  partner: Relation<Partner>;

  // Destino, para que el agente filtre por región
  @Column({ name: "destination_region_id", type: "varchar", length: 36 })
  destinationRegionId: string;

  @ManyToOne("Region", { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "destination_region_id" })
  destinationRegion: Relation<Region>;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Index("uq_packages_slug", { unique: true })
  @Column({ type: "varchar", length: 180 })
  slug: string;

  @Column({ type: "varchar", length: 300 })
  summary: string;

  @Column({ type: "text" })
  description: string;

  // Galería: URLs de imágenes (la subida de archivos no está implementada).
  @Column({ type: "json" })
  images: string[];

  // Los días se calculan: noches + 1
  @Column({ type: "int" })
  nights: number;

  @Column({ name: "min_travelers", type: "int", default: 1 })
  minTravelers: number;

  @Column({ name: "max_travelers", type: "int", nullable: true })
  maxTravelers: number | null;

  // Rango de edad que paga tarifa de menor (ej. 3 a 11)
  @Column({ name: "child_min_age", type: "int", nullable: true })
  childMinAge: number | null;

  @Column({ name: "child_max_age", type: "int", nullable: true })
  childMaxAge: number | null;

  @Column({ name: "meeting_point", type: "varchar", length: 255, nullable: true })
  meetingPoint: string | null;

  // Documentos, edad mínima, restricciones
  @Column({ type: "text", nullable: true })
  requirements: string | null;

  @Column({ name: "cancellation_policy", type: "text" })
  cancellationPolicy: string;

  // Si el precio de las salidas ya incluye impuestos
  @Column({ name: "taxes_included", type: "boolean", default: true })
  taxesIncluded: boolean;

  @Column({ type: "enum", enum: PackageStatus, default: PackageStatus.DRAFT })
  status: PackageStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}