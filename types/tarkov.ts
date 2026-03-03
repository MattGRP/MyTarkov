export interface PlayerProfile {
  aid: number;
  info: PlayerInfo;
  customization: PlayerCustomization;
  skills?: PlayerSkills;
  equipment?: EquipmentContainer;
  pmcStats?: GameStats;
  scavStats?: GameStats;
  achievements?: Record<string, number>;
  favoriteItems?: string[];
  hideout?: HideoutData;
  hideoutAreaStashes?: HideoutAreaStash[];
  items?: EquipmentItem[];
  updated?: number;
}

export interface PlayerInfo {
  nickname: string;
  side: string;
  experience: number;
  level?: number;
  memberCategory?: number;
  selectedMemberCategory?: number;
  prestigeLevel?: number;
}

export interface PlayerCustomization {
  head?: string;
  body?: string;
  feet?: string;
  hands?: string;
}

export interface EquipmentContainer {
  Id: string;
  Items: EquipmentItem[];
}

export interface EquipmentItem {
  _id: string;
  _tpl: string;
  parentId?: string;
  slotId?: string;
  upd?: ItemUpdate;
}

export interface ItemUpdate {
  StackObjectsCount?: number;
  Repairable?: RepairableState;
}

export interface RepairableState {
  Durability?: number;
  MaxDurability?: number;
}

export interface PlayerSkills {
  Common?: SkillEntry[];
  Mastering?: MasteringEntry[];
  Points?: number;
}

export interface SkillEntry {
  Id: string;
  Progress: number;
  PointsEarnedDuringSession?: number;
  LastAccess?: number;
}

export interface MasteringEntry {
  Id: string;
  Progress?: number;
}

export interface GameStats {
  eft?: EFTStats;
}

export interface EFTStats {
  totalInGameTime?: number;
  overAllCounters?: OverAllCounters;
}

export interface OverAllCounters {
  Items?: CounterItem[];
}

export interface CounterItem {
  Key: string[];
  Value: number;
}

export interface HideoutData {
  areas?: HideoutArea[];
  Areas?: HideoutArea[];
  [key: string]: unknown;
}

export interface HideoutArea {
  type?: string | number;
  areaType?: string | number;
  level?: number;
  Level?: number;
  active?: boolean;
  isActive?: boolean;
}

export interface HideoutAreaStash {
  Id?: string;
  id?: string;
  level?: number;
  Level?: number;
}

export interface PlayerStats {
  sessions: number;
  survived: number;
  kills: number;
  deaths: number;
  totalInGameTime: number;
  kd: number;
  survivalRate: number;
}

export interface SearchResult {
  id: string;
  name: string;
}

export interface ItemSearchResult {
  id: string;
  name: string;
  normalizedName?: string;
  shortName?: string;
  description?: string;
  basePrice?: number | null;
  avg24hPrice?: number | null;
  lastLowPrice?: number | null;
  changeLast48hPercent?: number | null;
  iconLink?: string;
  gridImageLink?: string;
  baseImageLink?: string;
  link?: string;
  wikiLink?: string;
  types?: string[];
  category?: { name: string };
}

export interface ItemVendor {
  id?: string;
  name: string;
  normalizedName?: string;
  imageLink?: string;
}

export interface ItemPriceEntry {
  price?: number;
  priceRUB?: number;
  currency?: string;
  source?: string;
  vendor?: ItemVendor | null;
}

export interface ItemHistoricalPrice {
  price?: number | null;
  priceMin?: number | null;
  offerCount?: number | null;
  offerCountMin?: number | null;
  timestamp?: string | null;
}

export interface ItemDetailProperties {
  __typename?: string;
  caliber?: string | null;
  stackMaxSize?: number | null;
  tracer?: boolean | null;
  ammoType?: string | null;
  projectileCount?: number | null;
  damage?: number | null;
  armorDamage?: number | null;
  fragmentationChance?: number | null;
  ricochetChance?: number | null;
  penetrationChance?: number | null;
  penetrationPower?: number | null;
  penetrationPowerDeviation?: number | null;
  initialSpeed?: number | null;
  lightBleedModifier?: number | null;
  heavyBleedModifier?: number | null;
  durabilityBurnFactor?: number | null;
  heatFactor?: number | null;
  staminaBurnPerDamage?: number | null;
  misfireChance?: number | null;
  failureToFeedChance?: number | null;
  class?: number | null;
  durability?: number | null;
  repairCost?: number | null;
  speedPenalty?: number | null;
  turnPenalty?: number | null;
  ergoPenalty?: number | null;
  zones?: string[] | null;
  headZones?: string[] | null;
  armorType?: string | null;
  bluntThroughput?: number | null;
  blindnessProtection?: number | null;
  deafening?: string | null;
  blocksHeadset?: boolean | null;
  capacity?: number | null;
  loadModifier?: number | null;
  ammoCheckModifier?: number | null;
  malfunctionChance?: number | null;
  energy?: number | null;
  hydration?: number | null;
  units?: number | null;
  type?: string | null;
  fuse?: number | null;
  minExplosionDistance?: number | null;
  maxExplosionDistance?: number | null;
  fragments?: number | null;
  contusionRadius?: number | null;
  uses?: number | null;
  useTime?: number | null;
  cures?: string[] | null;
  hitpoints?: number | null;
  maxHealPerUse?: number | null;
  hpCostLightBleeding?: number | null;
  hpCostHeavyBleeding?: number | null;
  painkillerDuration?: number | null;
  energyImpact?: number | null;
  hydrationImpact?: number | null;
  minLimbHealth?: number | null;
  maxLimbHealth?: number | null;
  effectiveDistance?: number | null;
  fireModes?: string[] | null;
  fireRate?: number | null;
  maxDurability?: number | null;
  recoilVertical?: number | null;
  recoilHorizontal?: number | null;
  sightingRange?: number | null;
}

export interface ItemDetail extends ItemSearchResult {
  inspectImageLink?: string;
  image512pxLink?: string;
  image8xLink?: string;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  accuracyModifier?: number | null;
  recoilModifier?: number | null;
  ergonomicsModifier?: number | null;
  loudness?: number | null;
  velocity?: number | null;
  blocksHeadphones?: boolean | null;
  fleaMarketFee?: number | null;
  minLevelForFlea?: number | null;
  lastOfferCount?: number | null;
  low24hPrice?: number | null;
  high24hPrice?: number | null;
  changeLast48h?: number | null;
  sellFor?: ItemPriceEntry[];
  buyFor?: ItemPriceEntry[];
  historicalPrices?: ItemHistoricalPrice[];
  properties?: ItemDetailProperties | null;
}

export interface TaskTraderRef {
  id?: string;
  name: string;
  normalizedName?: string;
  imageLink?: string;
}

export interface TraderLevel {
  id: string;
  level: number;
  requiredPlayerLevel?: number | null;
  requiredReputation?: number | null;
  requiredCommerce?: number | null;
  cashOffers?: TraderCashOffer[];
  barters?: TraderBarterOffer[];
}

export interface TraderOfferItemRef {
  id: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;
  types?: string[];
  category?: {
    name: string;
  };
}

export interface TraderContainedItem {
  item: TraderOfferItemRef;
  count?: number | null;
  quantity?: number | null;
}

export interface TraderCashOffer {
  id?: string | null;
  item: TraderOfferItemRef;
  minTraderLevel?: number | null;
  price?: number | null;
  currency?: string | null;
  currencyItem?: TraderOfferItemRef | null;
  priceRUB?: number | null;
  taskUnlock?: TaskRef | null;
  buyLimit?: number | null;
}

export interface TraderBarterOffer {
  id: string;
  level?: number | null;
  taskUnlock?: TaskRef | null;
  requiredItems?: TraderContainedItem[];
  rewardItems?: TraderContainedItem[];
  buyLimit?: number | null;
}

export interface TraderDetail {
  id: string;
  name: string;
  normalizedName?: string;
  description?: string;
  resetTime?: string | null;
  imageLink?: string;
  image4xLink?: string;
  levels?: TraderLevel[];
  cashOffers?: TraderCashOffer[];
  barters?: TraderBarterOffer[];
}

export interface TaskMapRef {
  id?: string;
  name: string;
  normalizedName?: string;
}

export interface TaskRef {
  id: string;
  name: string;
  normalizedName?: string;
}

export interface TaskStatusRequirement {
  task: TaskRef;
  status: string[];
}

export interface TaskTraderRequirement {
  trader: TaskTraderRef;
  requirementType?: string | null;
  compareMethod?: string | null;
  value?: number | null;
}

export interface TaskObjectiveItemRef {
  id: string;
  name: string;
  shortName?: string;
  iconLink?: string;
}

export interface TaskObjectiveLite {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  __typename?: string;
  count?: number | null;
  maps?: TaskMapRef[];
  item?: TaskObjectiveItemRef | null;
  items?: TaskObjectiveItemRef[];
  containsAll?: TaskObjectiveItemRef[];
  markerItem?: TaskObjectiveItemRef | null;
  useAny?: TaskObjectiveItemRef[];
  usingWeapon?: TaskObjectiveItemRef[];
  usingWeaponMods?: TaskObjectiveItemRef[];
  wearing?: TaskObjectiveItemRef[];
  notWearing?: TaskObjectiveItemRef[];
  requiredKeys?: TaskObjectiveItemRef[];
}

export interface TaskRewardItem {
  item?: {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
  } | null;
  count?: number | null;
}

export interface TaskTraderStanding {
  trader?: TaskTraderRef | null;
  standing?: number | null;
}

export interface TaskSkillReward {
  name?: string | null;
  level?: number | null;
}

export interface TaskRewardsLite {
  items?: TaskRewardItem[];
  traderStanding?: TaskTraderStanding[];
  skillLevelReward?: TaskSkillReward[];
}

export interface TaskDetail {
  id: string;
  name: string;
  normalizedName: string;
  trader: TaskTraderRef;
  map?: TaskMapRef | null;
  experience: number;
  wikiLink?: string | null;
  taskImageLink?: string | null;
  minPlayerLevel?: number | null;
  taskRequirements?: TaskStatusRequirement[];
  traderRequirements?: TaskTraderRequirement[];
  restartable?: boolean | null;
  objectives?: TaskObjectiveLite[];
  failConditions?: TaskObjectiveLite[];
  startRewards?: TaskRewardsLite | null;
  finishRewards?: TaskRewardsLite | null;
  failureOutcome?: TaskRewardsLite | null;
  factionName?: string | null;
  kappaRequired?: boolean | null;
  lightkeeperRequired?: boolean | null;
}

export const MAIN_SLOTS = [
  'Headwear', 'Earpiece', 'FaceCover', 'Eyewear',
  'ArmorVest', 'TacticalVest', 'ArmBand',
  'FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster',
  'Backpack', 'SecuredContainer', 'Scabbard',
] as const;

export function getSlotDisplayName(slot: string): string {
  const map: Record<string, string> = {
    FirstPrimaryWeapon: 'Primary',
    SecondPrimaryWeapon: 'Secondary',
    Holster: 'Sidearm',
    ArmorVest: 'Armor',
    TacticalVest: 'Rig',
    FaceCover: 'Face Cover',
    SecuredContainer: 'Secure',
    ArmBand: 'Armband',
  };
  return map[slot] ?? slot;
}

export function getItemImageURL(tpl: string): string {
  return `https://assets.tarkov.dev/${tpl}-icon.webp`;
}

export function getCharacterImageURL(
  profile: PlayerProfile,
  options?: { compact?: boolean },
): string {
  const compact = options?.compact === true;
  const equipmentItems = profile.equipment?.Items ?? [];
  const equipmentRootId = profile.equipment?.Id ?? '';
  const compactExcludedPrefixes = [
    'soft_armor',
    'front_plate',
    'back_plate',
    'collar',
    'groin',
    'pockets',
    'helmet_top',
    'helmet_back',
    'patron_in_weapon',
    'cartridges',
  ];
  const shouldExcludeCompactItem = (slotId?: string): boolean => {
    const normalized = (slotId ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return compactExcludedPrefixes.some((prefix) => normalized.startsWith(prefix));
  };

  const itemsToRender = compact
    ? (() => {
      const excludedIds = new Set<string>();
      const compactItems: Array<Record<string, string>> = [];
      for (const item of equipmentItems) {
        if (
          (item.parentId && excludedIds.has(item.parentId)) ||
          shouldExcludeCompactItem(item.slotId)
        ) {
          excludedIds.add(item._id);
          continue;
        }
        const dict: Record<string, string> = {
          _id: item._id,
          _tpl: item._tpl,
        };
        if (item.parentId) dict.parentId = item.parentId;
        if (item.slotId) dict.slotId = item.slotId;
        compactItems.push(dict);
      }
      return compactItems;
    })()
    : equipmentItems.map((item) => {
      const dict: Record<string, string> = {
        _id: item._id,
        _tpl: item._tpl,
      };
      if (item.parentId) dict.parentId = item.parentId;
      if (item.slotId) dict.slotId = item.slotId;
      return dict;
    });

  const dataObj = {
    aid: profile.aid,
    customization: {
      head: profile.customization.head ?? '',
      body: profile.customization.body ?? '',
      feet: profile.customization.feet ?? '',
      hands: profile.customization.hands ?? '',
    },
    equipment: {
      Id: equipmentRootId,
      Items: itemsToRender,
    },
  };
  const jsonString = JSON.stringify(dataObj);
  return `https://imagemagic.tarkov.dev/player/${profile.aid}.webp?data=${encodeURIComponent(jsonString)}`;
}

export function calculatePlayerStats(gameStats?: GameStats): PlayerStats {
  const counters = gameStats?.eft?.overAllCounters?.Items ?? [];
  const totalTime = gameStats?.eft?.totalInGameTime ?? 0;

  let sessions = 0;
  let survived = 0;
  let kills = 0;
  let deaths = 0;

  for (const item of counters) {
    const key = item.Key;
    if (key[0] === 'Sessions') {
      sessions += item.Value;
    } else if (key[0] === 'ExitStatus' && key.includes('Survived')) {
      survived += item.Value;
    } else if (key.length === 1 && key[0] === 'Kills') {
      kills = item.Value;
    } else if (key.length === 1 && key[0] === 'Deaths') {
      deaths = item.Value;
    }
  }

  const kd = deaths === 0 ? kills : kills / deaths;
  const survivalRate = sessions === 0 ? 0 : (survived / sessions) * 100;

  return { sessions, survived, kills, deaths, totalInGameTime: totalTime, kd, survivalRate };
}

const XP_THRESHOLDS = [
  0, 1000, 4017, 8432, 14256, 21477, 30023, 39936, 51204, 63723,
  77563, 92713, 110144, 128384, 149867, 172144, 197203, 225938, 259311, 295287,
  336008, 382308, 432768, 490936, 557528, 631688, 714168, 804808, 905408, 1018908,
  1141108, 1272508, 1413908, 1570708, 1742908, 1930508, 2133508, 2351908, 2585708, 2834908,
  3099508, 3379508, 3674908, 3985708, 4311908, 4653508, 5010508, 5382908, 5770708, 6173908,
  6592508, 7026508, 7475908, 7940708, 8420908, 8916508, 9427508, 9953908, 10495708, 11052908,
  11625508, 12213508, 12816908, 13435708, 14069908, 14719508, 15384508, 16064908, 16760708, 17471908,
];

export function getLevel(experience: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (experience >= XP_THRESHOLDS[i]) {
      lvl = i + 1;
    } else {
      break;
    }
  }
  return lvl;
}

export interface PlayerLevelData {
  level: number;
  exp: number;
  levelBadgeImageLink?: string;
}

export function getLevelFromPlayerLevels(experience: number, levels: PlayerLevelData[]): number {
  if (!experience || levels.length === 0) return 1;
  let expTotal = 0;
  let level = 1;
  for (let i = 0; i < levels.length; i++) {
    expTotal += levels[i].exp;
    if (expTotal === experience) {
      level = levels[i].level;
      break;
    }
    if (expTotal > experience) {
      level = levels[Math.max(0, i - 1)].level;
      break;
    }
  }
  return level;
}
