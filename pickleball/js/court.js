'use strict';
// Court geometry and the official dimensions of a pickleball court.
// All world units are FEET. Origin is the centre of the net.
//   x : across the court, sidelines at +/-10
//   y : height above the ground
//   z : along the court, baselines at +/-22. Team 0 owns z<0 (near/camera side),
//       team 1 owns z>0 (far side).
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Court = {
  HALF_W: 10,          // 20 ft wide
  HALF_L: 22,          // 44 ft long
  KITCHEN: 7,          // non-volley zone depth from the net
  NET_HALF_W: 11,      // posts sit 1 ft outside each sideline
  NET_H_CENTER: 2.833, // 34 in
  NET_H_POST: 3.0,     // 36 in
  BALL_R: 0.121,       // 2.9 in diameter
  LINE_W: 0.166,       // 2 in lines
  OUT_TOL: 0.06,       // friendly sliver so pixel-perfect lines are not brutal

  netHeightAt(x) {
    const t = Math.min(1, Math.abs(x) / this.NET_HALF_W);
    return this.NET_H_CENTER + (this.NET_H_POST - this.NET_H_CENTER) * t * t;
  },

  // team 0 lives on negative z, team 1 on positive z
  teamSign(team) { return team === 0 ? -1 : 1; },
  sideOf(z) { return z < 0 ? 0 : 1; },

  // A player facing the net sees "their right" on +x for team 0 and -x for team 1.
  rightSignFor(team) { return team === 0 ? 1 : -1; },

  inBounds(x, z) {
    const t = this.OUT_TOL;
    return Math.abs(x) <= this.HALF_W + t && Math.abs(z) <= this.HALF_L + t;
  },

  // The NVZ line belongs to the kitchen.
  inKitchen(x, z, team) {
    if (team !== undefined && this.sideOf(z) !== team) return false;
    return Math.abs(x) <= this.HALF_W && Math.abs(z) <= this.KITCHEN;
  },

  // Service box on `team`'s side of the net, on the half whose x has sign xSign.
  // A serve landing on (or short of) the kitchen line is a fault.
  inServiceBox(x, z, team, xSign) {
    const t = this.OUT_TOL;
    if (this.sideOf(z) !== team) return false;
    const az = Math.abs(z), ax = Math.abs(x);
    if (az <= this.KITCHEN || az > this.HALF_L + t) return false;
    if (ax > this.HALF_W + t) return false;
    return Math.sign(x) === xSign || ax < 0.15; // centre line is a fault in theory, be kind
  },

  clampToPlayArea(p, team) {
    const s = this.teamSign(team);
    p.x = Math.max(-this.HALF_W - 5, Math.min(this.HALF_W + 5, p.x));
    // never cross the net plane
    if (s < 0) p.z = Math.max(-this.HALF_L - 7, Math.min(-0.7, p.z));
    else       p.z = Math.min(this.HALF_L + 7, Math.max(0.7, p.z));
    return p;
  },
};
