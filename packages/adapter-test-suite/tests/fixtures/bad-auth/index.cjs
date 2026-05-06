'use strict';

// Single-export fixture: when loaded via ESM import(), CJS interop wraps
// module.exports as the default — so the runner sees default.category === 'storage'
// (intentionally wrong) and the auth/listProviders bootstrap fails first.
module.exports = { category: 'storage', id: 'bad-auth' };
