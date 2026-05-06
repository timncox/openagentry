'use strict';

// Manifest correctly claims wiki; default export has category wiki. But the
// methods break every functional check:
//   list:        returns a non-array (string) to fail wiki/list-returns-array
//   read:        always returns empty string (never throws even on missing path)
//   write:       silent no-op, returns { status: 'unchanged' }
//   append:      silent no-op, returns { status: 'unchanged' }
//   search:      always returns empty array

const adapter = {
  category: 'wiki',
  id: 'bad-wiki-functional',
  async list() {
    return 'not-an-array'; // wrong type to fail wiki/list-returns-array
  },
  async read() {
    return ''; // never throws — fails wiki/structured-errors
  },
  async write(p) {
    return { path: p, status: 'unchanged' }; // never persists
  },
  async append(p) {
    return { path: p, status: 'unchanged' };
  },
  async search() {
    return [];
  },
};

module.exports = adapter;
module.exports.default = adapter;
