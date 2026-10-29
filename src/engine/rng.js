/*
 * Small seeded random number helpers. A seed makes fake data repeatable:
 * the same seed + the same original value always gives the same fake value.
 */
(function (root) {
  'use strict';

  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor(seed, key) {
    return mulberry32(hashString(String(seed) + '|' + key));
  }

  function newSeed() {
    try {
      const a = new Uint32Array(2);
      (root.crypto || require('crypto').webcrypto).getRandomValues(a);
      return a[0].toString(36) + a[1].toString(36);
    } catch (e) {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  const api = { hashString, mulberry32, rngFor, newSeed };
  root.DeidRng = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
