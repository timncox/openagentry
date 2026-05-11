'use strict';
// Mimics tsup's CJS output pattern: __toCommonJS wraps a src_exports
// object whose `.default` getter returns the adapter, plus named exports.
// Under Node's CJS-ESM interop, dynamic import of this file gives:
//   mod.default        === the WHOLE module.exports object
//   mod.default.default === the adapter (the ESM `export default adapter`)
// The plugin loader must unwrap that double-default.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

var src_exports = {};
__export(src_exports, {
  createFakeAdapter: () => createFakeAdapter,
  default: () => src_default,
});

function createFakeAdapter(opts) {
  return {
    category: 'host',
    id: 'fake-tsup-host',
    name: opts && opts.name ? opts.name : 'default',
  };
}

var src_default = createFakeAdapter({});
module.exports = __toCommonJS(src_exports);
