import { Schema } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

/**
 * Mongoose plugin that generates UUIDv7 for MongoDB documents
 * Replaces default ObjectId with sortable UUIDv7
 * 
 * Usage:
 * ```typescript
 * const schema = SchemaFactory.createForClass(MyClass);
 * schema.plugin(uuidv7Plugin);
 * ```
 */
export function uuidv7Plugin(schema: Schema) {
  // Override _id field to use string type for UUIDv7
  schema.set('_id', false);
  schema.add({ _id: { type: String, required: true, default: () => uuidv7() } });
}
