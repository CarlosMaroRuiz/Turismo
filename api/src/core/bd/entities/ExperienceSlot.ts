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
import type { Experience } from "./Experience.js";

export enum SlotStatus {
  OPEN = "open",
  CLOSED = "closed",
}

/**
 * Turno concreto de una experiencia: fecha + hora de inicio + aforo.
 * `booked` lo mueve el flujo de reservas; por eso no se acepta en la API de
 * gestión (solo capacity y status).
 */
@Entity("experience_slots")
@Index("uq_experience_slots_slot", ["experienceId", "date", "startTime"], {
  unique: true,
})
@Index("idx_experience_slots_date_status", ["date", "status"])
export class ExperienceSlot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "experience_id", type: "varchar", length: 36 })
  experienceId: string;

  @ManyToOne("Experience", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "experience_id" })
  experience: Relation<Experience>;

  /** Fecha del turno, "YYYY-MM-DD". */
  @Column({ type: "date" })
  date: string;

  /** Hora local de inicio, "HH:MM". */
  @Column({ name: "start_time", type: "varchar", length: 5 })
  startTime: string;

  @Column({ type: "int" })
  capacity: number;

  @Column({ type: "int", default: 0 })
  booked: number;

  @Column({ type: "enum", enum: SlotStatus, default: SlotStatus.OPEN })
  status: SlotStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
