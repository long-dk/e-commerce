import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { NotificationService } from './notification.service';
import { Notification, NotificationStatus } from './notification.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: Repository<Notification>;
  let pubSub: PubSub;

  const mockNotification: Notification = {
    id: '1',
    userId: 'user-1',
    title: 'Test',
    message: 'Hello',
    channel: 'INAPP',
    status: NotificationStatus.PENDING,
    payload: {},
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'PUB_SUB',
          useValue: { publish: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    pubSub = module.get<PubSub>('PUB_SUB');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create notification', async () => {
    const input = { userId: 'user-1', title: 'Test', message: 'Hello' };
    jest.spyOn(repository, 'create').mockReturnValue(mockNotification);
    jest.spyOn(repository, 'save').mockResolvedValue(mockNotification);

    const result = await service.create(input as any);

    expect(repository.create).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(mockNotification);
    expect(pubSub.publish).toHaveBeenCalledWith('notificationCreated', {
      notificationCreated: mockNotification,
    });
    expect(result).toEqual(mockNotification);
  });
});