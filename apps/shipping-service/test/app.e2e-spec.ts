import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/demo/app.module';

describe('ShippingService (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/demo/shipping (GET)', () => {
    return request(app.getHttpServer())
      .get('/demo/shipping')
      .expect(200)
      .expect([]);
  });

  it('/demo/shipping (POST) - create shipment', () => {
    return request(app.getHttpServer())
      .post('/demo/shipping')
      .send({
        orderId: 'order-123',
        carrier: 'FedEx',
        trackingNumber: 'TRACK123456',
      })
      .expect(201)
      .then((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body.orderId).toBe('order-123');
        expect(response.body.status).toBe('PENDING');
      });
  });
});
