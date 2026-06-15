import { EventSubscriber, InsertEvent, DataSource, EntityMetadata, EntitySubscriberInterface } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Subscriber that generates UUIDv7 for all entities with uuid primary keys
 * UUIDv7 is time-based and sortable, providing better database performance
 */
@EventSubscriber()
export class UuidV7Subscriber implements EntitySubscriberInterface {
  /**
   * Generate UUIDv7 for primary key before insert
   */
  beforeInsert(event: InsertEvent<any>) {
    const metadata = event.metadata;
    
    // Check if this entity has a UUID primary column
    if (metadata.primaryColumns.length === 1) {
      const primaryColumn = metadata.primaryColumns[0];
      
      // If primary column type is uuid and not already set, generate UUIDv7
      if (primaryColumn.type === 'uuid') {
        if (!event.entity[primaryColumn.propertyName]) {
          event.entity[primaryColumn.propertyName] = uuidv7();
        }
      }
    }
  }
}
