import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getModelToken } from '@nestjs/mongoose';
import { Product } from './product.schema';
import { KafkaService } from '@app/kafka';
import { ProductGateway } from './product.gateway';

describe('ProductService', () => {
  let service: ProductService;
  let mockProductModel: any;
  let mockKafkaService: any;

  beforeEach(async () => {
    const mockProductInstance = {
      _id: 'product-id',
      save: jest.fn(),
    };

    mockProductModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: 'product-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: 'product-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }));

    mockKafkaService = {
      sendMessage: jest.fn(),
      subscribeToTopic: jest.fn(),
    };

    const mockProductGateway = {
      emitProductCreated: jest.fn(),
      emitProductUpdated: jest.fn(),
      emitProductDeleted: jest.fn(),
      emitStockUpdated: jest.fn(),
      emitLowStockAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
        {
          provide: KafkaService,
          useValue: mockKafkaService,
        },
        {
          provide: ProductGateway,
          useValue: mockProductGateway,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product and publish event', async () => {
      const createProductDto = {
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        category: 'Test Category',
        brand: 'Test Brand',
        stock: 10,
        images: ['image.jpg'],
        tags: ['test'],
      };

      mockKafkaService.sendMessage.mockResolvedValue(undefined);

      const result = await service.create(createProductDto);

      expect(mockProductModel).toHaveBeenCalledWith(createProductDto);
      expect(mockKafkaService.sendMessage).toHaveBeenCalledWith('product.created', [
        {
          key: 'product-id',
          value: expect.any(String),
          headers: { eventType: 'ProductCreated' },
        },
      ]);
      expect(result).toBeDefined();
    });
  });
});
