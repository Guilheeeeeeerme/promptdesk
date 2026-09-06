jest.mock('../auth/session.service', () => ({
  SessionService: class SessionService {},
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));
import { ChatGateway } from './chat.gateway';
import type { GuidelineValidationEvent } from './chat.constants';

describe('ChatGateway guideline events', () => {
  it('allows a platform user to subscribe to a company guideline room', async () => {
    const join = jest.fn().mockResolvedValue(undefined);
    const gateway = new ChatGateway({} as never, {} as never) as ChatGateway & {
      subscribeToGuidelines: (
        client: unknown,
        body: { companyId: string },
      ) => Promise<{ status: string }>;
    };

    await expect(
      gateway.subscribeToGuidelines(
        {
          data: {
            session: {
              userId: 'admin-1',
              role: 'admin',
              activeCompanyId: null,
            },
          },
          join,
        },
        { companyId: 'company-1' },
      ),
    ).resolves.toEqual({ status: 'subscribed' });
    expect(join).toHaveBeenCalledWith('company:company-1');
  });

  it('refuses a tenant user subscribing to another company', async () => {
    const join = jest.fn();
    const gateway = new ChatGateway({} as never, {} as never) as ChatGateway & {
      subscribeToGuidelines: (
        client: unknown,
        body: { companyId: string },
      ) => Promise<{ status: string }>;
    };

    await expect(
      gateway.subscribeToGuidelines(
        {
          data: {
            session: {
              userId: 'manager-1',
              role: 'manager',
              activeCompanyId: 'company-1',
            },
          },
          join,
        },
        { companyId: 'company-2' },
      ),
    ).resolves.toEqual({ status: 'forbidden' });
    expect(join).not.toHaveBeenCalled();
  });

  it('routes guideline validation updates to the company room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new ChatGateway({} as never, {} as never) as ChatGateway & {
      server: { to: typeof to };
      dispatchChannelEvent: (event: GuidelineValidationEvent) => void;
    };
    gateway.server = { to };
    const event: GuidelineValidationEvent = {
      type: 'guideline_validation',
      companyId: 'company-1',
      versionId: 'version-4',
      version: 4,
      status: 'valid',
      activeVersion: 4,
      occurredAt: '2026-09-06T12:00:00.000Z',
    };

    gateway.dispatchChannelEvent(event);

    expect(to).toHaveBeenCalledWith('company:company-1');
    expect(emit).toHaveBeenCalledWith('guideline:validation', event);
  });
});
