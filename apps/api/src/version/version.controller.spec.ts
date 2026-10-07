import { Test, TestingModule } from '@nestjs/testing';
import { VersionController } from './version.controller';
import { VersionModule } from './version.module';

describe('VersionController', () => {
  const ORIGINAL_GIT_SHA = process.env.GIT_SHA;

  afterEach(() => {
    if (ORIGINAL_GIT_SHA === undefined) {
      delete process.env.GIT_SHA;
    } else {
      process.env.GIT_SHA = ORIGINAL_GIT_SHA;
    }
  });

  it('returns the injected git sha and service name', async () => {
    process.env.GIT_SHA = 'abc123';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();
    const controller = moduleFixture.get(VersionController);

    expect(controller.version()).toEqual({
      gitsha: 'abc123',
      service: 'promptdesk-api',
    });
  });

  it('falls back to an unknown sha when GIT_SHA is missing', async () => {
    delete process.env.GIT_SHA;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();
    const controller = moduleFixture.get(VersionController);

    expect(controller.version()).toEqual({
      gitsha: 'unknown',
      service: 'promptdesk-api',
    });
  });
});
