import { Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

@Scalar('UUID', () => String)
export class UUIDScalar {
  description = 'UUID custom scalar type';

  parseValue(value: any): string {
    if (typeof value !== 'string' || !validateUuid(value)) {
      throw new Error('Invalid UUID format');
    }
    return value;
  }

  serialize(value: any): string {
    if (typeof value !== 'string' || !validateUuid(value)) {
      throw new Error('Invalid UUID format');
    }
    return value;
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new Error('UUID must be a string');
    }
    if (!validateUuid(ast.value)) {
      throw new Error('Invalid UUID format');
    }
    return ast.value;
  }
}

@Scalar('DateTime', () => Date)
export class DateTimeScalar {
  description = 'Date custom scalar type';

  parseValue(value: any): Date {
    return new Date(value);
  }

  serialize(value: any): string {
    return value.toISOString();
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind !== Kind.STRING) {
      throw new Error('Date must be a string');
    }
    return new Date(ast.value);
  }
}
