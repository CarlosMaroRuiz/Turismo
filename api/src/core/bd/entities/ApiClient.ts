import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Credencial de servicio (servicio de LLM, integraciones). No es un usuario:
 * se autentica con client id + secreto y recibe un token con permisos acotados.
 */
@Entity("api_clients")
export class ApiClient {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("uq_api_clients_client_id", { unique: true })
  @Column({ name: "client_id", type: "varchar", length: 60 })
  clientId: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  // bcrypt del secreto: el valor en claro solo se conoce cuando se configura.
  @Column({ name: "secret_hash", type: "varchar", length: 255 })
  secretHash: string;

  @Column({ type: "json" })
  scopes: string[];

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @Column({ name: "last_used_at", type: "timestamp", nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
