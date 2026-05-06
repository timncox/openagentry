'use strict';

const adapter = {
  category: 'auth',
  id: 'bad-auth-functional',
  async listProviders() {
    return []; // empty → auth/listProviders fails
  },
  async verifySession(_token) {
    // Always returns a fake session, regardless of input —
    // breaks rejects-invalid, rejects-expired, AND structured-errors checks.
    return {
      userId: 'fake-user',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
  },
};

module.exports = adapter;
module.exports.default = adapter;
