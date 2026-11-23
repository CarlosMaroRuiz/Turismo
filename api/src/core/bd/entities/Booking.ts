import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type BookingStatus = "pending_payment" | "capturing" | "confirmed" | "expired" | "payment_failed";

@Entity("bookings")
@Index("uq_bookings_quote", ["quoteId"], { unique: true })
@Index("uq_bookings_paypal_order", ["paypalOrderId"], { unique: true })
@Index("idx_bookings_inventory", ["departureId", "status", "expiresAt"])
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "quote_id", type: "varchar", length: 36 })
  quoteId: string;

  @Column({ name: "departure_id", type: "varchar", length: 36 })
  departureId: string;

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
