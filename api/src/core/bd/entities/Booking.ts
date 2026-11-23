import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type BookingStatus = "pending_payment" | "capturing" | "confirmed" | "expired" | "payment_failed";
export type BookingItemType = "package_departure" | "room_stay" | "experience_slot";

@Entity("bookings")
@Index("uq_bookings_quote", ["quoteId"], { unique: true })
@Index("uq_bookings_paypal_order", ["paypalOrderId"], { unique: true })
@Index("uq_bookings_reference", ["reference"], { unique: true })
@Index("idx_bookings_inventory", ["departureId", "status", "expiresAt"])
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Clave maestra que se comparte con el viajero y el proveedor. */
  @Column({ type: "varchar", length: 12 })
  reference: string;

  @Column({ name: "quote_id", type: "varchar", length: 36 })
  quoteId: string;

  /**
   * Tipo del ítem reservado: package_departure | room_stay | experience_slot.
   * Se usa para saber en qué tabla buscar el ítem y qué incrementar al confirmar.
   */
  @Column({ name: "item_type", type: "varchar", length: 30, default: "package_departure" })
  itemType: BookingItemType;

  /**
   * ID del recurso físico reservado (departure_id, room_type_id o slot_id).
   * Para paquetes coincide con departure_id; en hoteles y experiencias usa este campo.
   */
  @Column({ name: "item_id", type: "varchar", length: 36 })
  itemId: string;

  /**
   * Columna legacy: solo tiene valor en reservas de paquetes para mantener
   * compatibilidad con el índice de inventario y la FK existente.
   * En hoteles y experiencias es NULL.
   */
  @Column({ name: "departure_id", type: "varchar", length: 36, nullable: true })
  departureId: string | null;

  /**
   * JSON con detalles del ítem (checkIn/checkOut para hoteles, fecha/hora para
   * experiencias, fecha de salida para paquetes). Se usa en el comprobante.
   */
  @Column({ name: "item_detail", type: "json", nullable: true })
  itemDetail: Record<string, unknown> | null;

  @Column({ name: "client_id", type: "varchar", length: 60 })
  clientId: string;

  @Column({ name: "traveler_ref", type: "varchar", length: 80 })
  travelerRef: string;

  @Column({ type: "int" })
  seats: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  total: string;

  @Column({ type: "varchar", length: 3 })
  currency: string;

  @Column({ type: "varchar", length: 20 })
  status: BookingStatus;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  @Column({ name: "paypal_order_id", type: "varchar", length: 36, nullable: true })
  paypalOrderId: string | null;

  @Column({ name: "paypal_approval_url", type: "varchar", length: 1024, nullable: true })
  paypalApprovalUrl: string | null;

  @Column({ name: "paypal_capture_id", type: "varchar", length: 36, nullable: true })
  paypalCaptureId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}
