export const pickRandom = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

export function createRandom(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    s |= 0;
    return ((s >>> 0) % 4294967296) / 4294967296;
  };
}
