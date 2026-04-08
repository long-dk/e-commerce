import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, logLevel, Message } from 'kafkajs';

interface KafkaMessage {
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

@Injectable()
export class KafkaService implements OnModuleInit {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

    this.kafka = new Kafka({
      clientId: process.env.SERVICE_NAME || 'ecommerce-client',
      brokers,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId: process.env.SERVICE_NAME || 'ecommerce-group',
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      await this.consumer.connect();
    } catch (error) {
      console.error('Failed to connect to Kafka:', error);
    }
  }

  async sendMessage(topic: string, messages: KafkaMessage[]) {
    try {
      await this.producer.send({
        topic,
        messages,
      });
    } catch (error) {
      console.error(`Error sending message to topic ${topic}:`, error);
      throw error;
    }
  }

  async subscribeToTopic(
    topic: string,
    callback: (message: Message) => Promise<void>,
  ) {
    try {
      await this.consumer.subscribe({ topic });
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await callback(message);
          } catch (error) {
            console.error(`Error processing message from ${topic}:`, error);
          }
        },
      });
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      throw error;
    }
  }

  async disconnect() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }
}
