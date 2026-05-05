'use strict';

// Bad fixture: module category is 'host' even though manifest says 'db'.
// The db/createInstance bootstrap check in dbSuite should catch this.
module.exports = { category: 'host', id: 'bad-db' };
