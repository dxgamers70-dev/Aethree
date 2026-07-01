// Self-hosted library of genuinely-distinct 3D models (no recolors).
// Sourced from three.js examples + Khronos glTF Sample Assets (permissive / CC-BY / CC0).
// An agent's avatarRef is simply the GLB path.

export type Category = "Humanoid" | "Mech" | "Creature" | "Vehicle" | "Object";
export const CATEGORIES: Category[] = ["Humanoid", "Mech", "Creature", "Vehicle", "Object"];

export type AvatarModel = { url: string; name: string; category: Category; emoji: string };

const m = (file: string, name: string, category: Category, emoji: string): AvatarModel => ({
  url: `/avatars/${file}.glb`,
  name,
  category,
  emoji,
});

export const MODELS: AvatarModel[] = [
  // Humanoid
  m("readyplayerme", "Operator", "Humanoid", "🧑‍🚀"),
  m("soldier", "Soldier", "Humanoid", "🪖"),
  m("xbot", "Unit-X", "Humanoid", "🤖"),
  m("rigged-figure", "Mannequin", "Humanoid", "🧍"),
  m("rigged-simple", "Rigling", "Humanoid", "🦾"),
  m("cesium-man", "Runner", "Humanoid", "🏃"),
  m("nefertiti", "Nefertiti", "Humanoid", "🗿"),
  // Mech
  m("robot-expressive", "Expressive Bot", "Mech", "🤖"),
  m("brain-stem", "BrainStem", "Mech", "🧠"),
  m("damaged-helmet", "War Helm", "Mech", "🪖"),
  // Creature
  m("fox", "Fox", "Creature", "🦊"),
  m("dragon", "Dragon", "Creature", "🐉"),
  m("parrot", "Parrot", "Creature", "🦜"),
  m("flamingo", "Flamingo", "Creature", "🦩"),
  m("stork", "Stork", "Creature", "🐦"),
  m("horse", "Stallion", "Creature", "🐎"),
  m("duck", "Duck", "Creature", "🦆"),
  // Vehicle
  m("toy-car", "Toy Car", "Vehicle", "🚗"),
  m("cesium-milk-truck", "Milk Truck", "Vehicle", "🚚"),
  // Object
  m("avocado", "Avocado", "Object", "🥑"),
  m("water-bottle", "Hydro", "Object", "🍶"),
  m("box-animated", "Pulse Box", "Object", "📦"),
  m("chair-damask-purplegold", "Royal Chair", "Object", "🪑"),
  m("sheen-chair", "Sheen Chair", "Object", "🪑"),
  m("glam-velvet-sofa", "Velvet Sofa", "Object", "🛋️"),
  m("specular-silk-pouf", "Silk Pouf", "Object", "🟣"),
  m("glass-broken-window", "Shatter", "Object", "🪟"),
  m("glass-hurricane-candle-holder", "Hurricane", "Object", "🕯️"),
  m("glass-vase-flowers", "Bloom Vase", "Object", "🌷"),
  m("pot-of-coals", "Ember Pot", "Object", "🔥"),
];

export const DEFAULT_AVATAR = MODELS[0].url;

export function getModel(url?: string | null): AvatarModel | undefined {
  return MODELS.find((x) => x.url === url);
}

/** Resolve a stored avatarRef to a loadable GLB url; legacy/empty refs fall back to the default. */
export function resolveAvatarUrl(ref?: string | null): string {
  if (ref && (ref.startsWith("/avatars/") || ref.startsWith("http://") || ref.startsWith("https://"))) {
    return ref;
  }
  return DEFAULT_AVATAR;
}
