import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/utils/prisma.js';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    business: {
      findMany: vi.fn(),
      count: vi.fn(),
    }
  }
}));

describe('Business API Routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/businesses', () => {
    it('should return a paginated list of businesses (Public Route)', async () => {
      // Mock the database response
      const mockBusinesses = [
        { id: '1', name: 'Salon A', slug: 'salon-a' },
        { id: '2', name: 'Gym B', slug: 'gym-b' }
      ];
      
      prisma.business.findMany.mockResolvedValue(mockBusinesses);
      prisma.business.count.mockResolvedValue(2);

      const response = await request(app).get('/api/v1/businesses');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Salon A');
      expect(response.body.meta.total).toBe(2);
    });

    it('should handle search queries correctly', async () => {
      prisma.business.findMany.mockImplementation(async (args) => {
        expect(args.where.name.contains).toBe('Gym');
        return [{ id: '2', name: 'Gym B', slug: 'gym-b' }];
      });
      prisma.business.count.mockResolvedValue(1);

      const response = await request(app).get('/api/v1/businesses?search=Gym');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Gym B');
    });
  });
});
