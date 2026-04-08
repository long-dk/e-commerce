import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { ShippingService } from './shipping.service';
import { Shipment, ShippingStatus } from './shipping.entity';

describe('ShippingService', () => {
  let service: ShippingService;
  let repository: Repository<Shipment>;
  let pubSub: PubSub;

  const mockShipment: Shipment = {
    id: '1',
    orderId: 'order-123',
    status: ShippingStatus.PENDING,
    carrier: 'FedEx',
    trackingNumber: 'TRACK123456',
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isComplete: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        {
          provide: getRepositoryToken(Shipment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'PUB_SUB',
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    repository = module.get<Repository<Shipment>>(getRepositoryToken(Shipment));
    pubSub = module.get<PubSub>('PUB_SUB');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new shipment', async () => {
      const createInput = {
        orderId: 'order-123',
        carrier: 'FedEx',
        trackingNumber: 'TRACK123456',
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockShipment);
      jest.spyOn(repository, 'save').mockResolvedValue(mockShipment);

      const result = await service.create(createInput);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          status: ShippingStatus.PENDING,
          carrier: 'FedEx',
          trackingNumber: 'TRACK123456',
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockShipment);
      expect(pubSub.publish).toHaveBeenCalledWith('shipmentCreated', {
        shipmentCreated: mockShipment,
      });
      expect(result).toEqual(mockShipment);
    });
  });

  describe('findOne', () => {
    it('should return a shipment by id', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockShipment);

      const result = await service.findOne('1');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(mockShipment);
    });
  });

  describe('markAsShipped', () => {
    it('should mark shipment as shipped', async () => {
      const shippedShipment = { ...mockShipment, status: ShippingStatus.SHIPPED, shippedAt: new Date() };

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockShipment);
      jest.spyOn(repository, 'save').mockResolvedValue(shippedShipment);

      const result = await service.markAsShipped('1');

      expect(repository.save).toHaveBeenCalled();
      expect(result.status).toBe(ShippingStatus.SHIPPED);
      expect(result.shippedAt).toBeDefined();
    });
  });
});