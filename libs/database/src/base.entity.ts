import {
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base entity with UUIDv7 primary key
 * All entities extending this will have:
 * - id: UUIDv7 (time-based, sortable, better for indexing)
 * - createdAt: Auto-populated timestamp
 * - updatedAt: Auto-updated timestamp
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
