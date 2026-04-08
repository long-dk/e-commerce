import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  INAPP = 'INAPP',
}

registerEnumType(NotificationStatus, {
  name: 'NotificationStatus',
});

registerEnumType(NotificationChannel, {
  name: 'NotificationChannel',
});

@ObjectType()
@Entity({ name: 'notifications' })
export class Notification {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  userId: string;

  @Field()
  @Column()
  title: string;

  @Field()
  @Column('text')
  message: string;

  @Field(() => NotificationChannel)
  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.INAPP })
  channel: NotificationChannel;

  @Field(() => NotificationStatus)
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  // Store additional data as JSON string
  @Field({ nullable: true })
  @Column({ nullable: true, type: 'text' })
  payload?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  readAt?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}