import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { decimalTransformer } from "../transformers/index.js";

/**
 * Cotización inmutable: guarda el desglose calculado por el API y un
 * vencimiento (15 min por defecto). El agente nunca inventa precios: reserva
 * contra un `quoteId` vigente.
 */
@Entity("quotes")
@Index("idx_quotes_expires_at", ["expiresAt"])
export class Quote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Referencia corta para mostrar al viajero, por ejemplo "QT-8F3A21". */
  @Index("uq_quotes_reference", { unique: true })
  @Column({ type: "varchar", length: 20 })
  reference: string;

  @Column({ type: "varchar", length: 3, default: "MXN" })
  currency: string;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal: number;

  @Column({
    name: "discount_total",
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  discountTotal: number;

  @Column({
    name: "taxes_total",
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  taxesTotal: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  total: number;

  /** Selección original (ids y cantidades) para auditoría y reserva. */
  @Column({ type: "json" })
  items: unknown;

  /** Desglose calculado por ítem, congelado al momento de cotizar. */
  @Column({ type: "json" })
  breakdown: unknown;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}
