import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("partner_categories")
export class PartnerCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Código fijo usado por el código de la app: "hotel", "agency", "attraction"
  @Index("uq_partner_categories_code", { unique: true })
  @Column({ type: "varchar", length: 30 })
  code: string;

  // Nombre visible: "Hotel", "Agencia de viajes", "Operador de atractivos"
  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}