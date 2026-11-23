import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

// Códigos fijos usados por el código de la app (guards, validaciones)
export enum RoleCode {
  SUPER_USER = "super_user",
  PARTNER = "partner",
}

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("uq_roles_code", { unique: true })
  @Column({ type: "varchar", length: 30 })
  code: string;

  // Nombre visible: "Super usuario", "Socio"
  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}