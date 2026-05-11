'use strict';
// Mimics adapter-db-neon / adapter-host-cloudflare: the default export is null
// when required env config is absent. Named factory still works.
module.exports = {
  default: null,
  createFakeAdapter(opts) {
    return { category: 'db', id: 'fake-null-db', config: opts };
  },
};
