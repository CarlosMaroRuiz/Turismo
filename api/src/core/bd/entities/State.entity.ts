import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("states")
export class State {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Clave INEGI de la entidad federativa (ej. "23" = Quintana Roo)
  @Index("uq_states_code", { unique: true })
  @Column({ type: "varchar", length: 2 })
  code: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  // ej. "quintana-roo"
  @Index("uq_states_slug", { unique: true })
  @Column({ type: "varchar", length: 120 })
  slug: string;

  // En MySQL se usa "json" en lugar de "array: true"
  @Column({ type: "json" })
  aliases: string[];

  // false por defecto: solo se activan los estados con oferta en el MVP
  @Index("idx_states_is_active")
  @Column({ name: "is_active", type: "boolean", default: false })
  isActive: boolean;

  // En MySQL se usa "timestamp" en lugar de "timestamptz"
  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
