export type Language = 'en' | 'zh' | 'ru';
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh', 'ru'];

export interface Translations {
  // Common
  back: string;
  retry: string;
  cancel: string;
  save: string;
  clear: string;
  apply: string;
  none: string;
  yes: string;
  no: string;
  overview: string;
  achievements: string;
  noAchievements: string;
  favoriteItems: string;
  noFavoriteItems: string;
  hideout: string;
  noHideout: string;
  reorderSection: string;
  reorderHint: string;
  moveUp: string;
  moveDown: string;
  moveTop: string;
  moveBottom: string;
  notFoundTitle: string;
  notFoundLink: string;

  // Tabs
  tabMyProfile: string;
  tabSearch: string;
  tabTasks: string;
  tabSettings: string;

  // Settings
  settingsTitle: string;
  language: string;
  languageValueEn: string;
  languageValueZh: string;
  languageValueRu: string;
  defaultPlayerName: string;
  defaultPlayerNamePlaceholder: string;
  defaultPlayerNameHint: string;
  turnstileToken: string;
  turnstileTokenPlaceholder: string;
  turnstileTokenHint: string;
  turnstileTokenHelp: string;
  turnstileOpenPlayers: string;
  settingsAccountIdTitle: string;
  settingsAccountIdCurrent: string;
  settingsAccountIdPlaceholder: string;
  settingsAccountIdHint: string;
  settingsAccountIdButton: string;
  settingsAccountIdUpdating: string;
  settingsAccountIdUnbindTitle: string;
  settingsAccountIdUnbindMessage: string;
  settingsAccountIdUnbindButton: string;
  settingsAccountIdUnbindAction: string;

  // Profile
  playerProfile: string;
  loadingProfile: string;
  failedToLoad: string;
  signOut: string;
  signOutConfirm: string;
  signOutConfirmMessage: string;
  level: string;
  xp: string;
  accountId: string;
  prestige: string;
  kd: string;
  survival: string;
  kills: string;
  raids: string;
  pmcStats: string;
  scavStats: string;
  totalRaids: string;
  survived: string;
  deaths: string;
  kdRatio: string;
  survivalRate: string;
  timeInRaids: string;
  accountTime: string;
  lastActive: string;
  profileUpdated: string;
  achievementTotal: string;
  achievementRarityCommon: string;
  achievementRarityRare: string;
  achievementRarityLegendary: string;
  achievementRarityUnknown: string;
  hideoutStash: string;
  exitKilled: string;
  exitLeft: string;
  exitMissing: string;
  exitRunThrough: string;
  exitTransit: string;
  longestWinStreak: string;

  // Search
  searchHeaderSubtitle: string;
  searchHeaderTitle: string;
  searchPlaceholder: string;
  searchNoPlayers: string;
  searchNoPlayersSub: string;
  searchForPlayer: string;
  searchUnknown: string;
  searchDbLoaded: string;
  searchDbDefault: string;
  searchDownloading: string;
  searchDownloadingSub: string;
  searchFirstTime: string;
  searchResults: string;
  searchTraderTitle: string;
  searchTraderPlaceholder: string;
  searchNoTraders: string;
  searchNoTradersSub: string;
  searchSortName: string;
  searchSortPrice: string;
  searchSortChange: string;
  searchFilterAll: string;
  searchFilterType: string;
  searchFilterCategory: string;
  itemTypeLabels: Record<string, string>;
  itemPropertyLabels: Record<string, string>;
  itemSectionAttributes: string;
  itemDetailsTitle: string;
  itemSectionFlea: string;
  itemSectionBuy: string;
  itemSectionTraders: string;
  itemSectionHistory: string;
  itemPriceBase: string;
  itemPriceFlea: string;
  itemPriceAvg24h: string;
  itemPriceLastLow: string;
  itemPriceChange48h: string;
  itemBuyFlea: string;
  itemNoBuyData: string;
  itemNoFleaData: string;
  itemNoTraderData: string;
  itemNoAttributes: string;
  itemNoHistory: string;
  itemAttrWeight: string;
  itemAttrSize: string;
  itemAttrErgo: string;
  itemAttrRecoil: string;
  itemAttrAccuracy: string;
  itemAttrLoudness: string;
  itemAttrVelocity: string;
  itemAttrBlocksHeadphones: string;
  itemAttrFleaFee: string;
  itemAttrMinFleaLevel: string;
  itemAttrOfferCount: string;
  itemHistoryTime: string;
  itemHistoryPrice: string;
  itemHistoryMin: string;
  itemHistoryOffers: string;
  itemHistoryMinLabel: string;
  itemHistoryMaxLabel: string;
  itemHistoryLastLabel: string;
  traderDetailsTitle: string;
  traderResetTime: string;
  traderDescription: string;
  traderLevels: string;
  traderRequiredPlayerLevel: string;
  traderRequiredReputation: string;
  traderRequiredCommerce: string;
  traderUnlockConditions: string;
  traderSellItems: string;
  traderCashOffers: string;
  traderBarterOffers: string;
  traderNoOffers: string;
  traderBuyLimit: string;
  traderTaskUnlock: string;
  traderBarterNeeds: string;

  // Tasks
  tasksHeaderTitle: string;
  tasksHeaderSubtitle: string;
  tasksSearchPlaceholder: string;
  taskFilterTrader: string;
  taskFilterLevel: string;
  taskFilterMap: string;
  taskFilterFaction: string;
  taskFilter3x4Required: string;
  taskFilterLightkeeperRequired: string;
  tasksNoResults: string;
  tasksNoResultsSub: string;
  tasksLoading: string;
  taskDetailsTitle: string;
  taskSectionInfo: string;
  taskSectionObjectives: string;
  taskSectionFailConditions: string;
  taskSectionRequirements: string;
  taskSectionRewards: string;
  taskInfoTrader: string;
  taskInfoMap: string;
  taskInfoLevel: string;
  taskInfoExperience: string;
  taskInfoFaction: string;
  taskInfoKappa: string;
  taskInfoLightkeeper: string;
  taskInfoRestartable: string;
  taskAnyMap: string;
  taskAnyFaction: string;
  taskNoObjectives: string;
  taskNoFailConditions: string;
  taskNoRequirements: string;
  taskNoRewards: string;
  taskRequiredTasks: string;
  taskRequiredStatus: string;
  taskTraderRequirements: string;
  taskTraderRequirementReputation: string;
  taskCompareLessOrEqual: string;
  taskRewardStart: string;
  taskRewardFinish: string;
  taskRewardFailure: string;
  taskRewardItems: string;
  taskRewardExperience: string;
  taskRewardStanding: string;
  taskRewardSkills: string;
  taskObjectiveShowMore: string;
  taskObjectiveShowLess: string;
  taskObjectiveOptional: string;
  taskOpenWiki: string;
  taskTag3x4: string;
  taskTagLightkeeper: string;

  // Hints
  hintKD: string;
  hintSurvival: string;
  hintSkills: string;
  skillsTitle: string;

  // Player Name Validation
  playerNameInvalidChars: string;
  playerNameInvalidLength: string;

  // Setup
  setupTitle: string;
  setupSubtitle: string;
  setupOpenPlayers: string;
  setupAccountIdLabel: string;
  setupAccountIdPlaceholder: string;
  setupAccountIdHint: string;
  setupLinkButton: string;
  setupInvalidAccountId: string;
  setupFetchingProfile: string;

  // Loadout
  loadout: string;
  noLoadout: string;
  slotPrimary: string;
  slotSecondary: string;
  slotSidearm: string;
  slotArmor: string;
  slotRig: string;
  slotBackpack: string;
  slotSecure: string;
  slotScabbard: string;
  slotArmband: string;
  slotHeadwear: string;
  slotEarpiece: string;
  slotFaceCover: string;
  slotEyewear: string;
}

const en: Translations = {
  back: 'Back',
  retry: 'Retry',
  cancel: 'Cancel',
  save: 'Save',
  clear: 'Clear',
  apply: 'Apply',
  none: 'None',
  yes: 'Yes',
  no: 'No',
  overview: 'Overview',
  achievements: 'Achievements',
  noAchievements: 'No achievements yet',
  favoriteItems: 'Favorite items',
  noFavoriteItems: 'No favorite items',
  hideout: 'Hideout',
  noHideout: 'No hideout data',
  reorderSection: 'Reorder section',
  reorderHint: 'Press and hold the handle to reorder',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveTop: 'Move to top',
  moveBottom: 'Move to bottom',
  notFoundTitle: 'Page not found',
  notFoundLink: 'Go to home',

  tabMyProfile: 'My Profile',
  tabSearch: 'Search',
  tabTasks: 'Tasks',
  tabSettings: 'Settings',

  settingsTitle: 'Settings',
  language: 'Language',
  languageValueEn: 'English',
  languageValueZh: '中文',
  languageValueRu: 'Russian',
  defaultPlayerName: 'Default player name',
  defaultPlayerNamePlaceholder: 'Enter player name',
  defaultPlayerNameHint: 'Used to prefill the search box.',
  turnstileToken: 'Turnstile token',
  turnstileTokenPlaceholder: 'Paste token from tarkov.dev',
  turnstileTokenHint: 'Optional. Required if search is blocked by Turnstile.',
  turnstileTokenHelp: 'Open the players page, complete Turnstile, then copy the token from the request URL (token=...).',
  turnstileOpenPlayers: 'Open tarkov.dev players',
  settingsAccountIdTitle: 'Account ID',
  settingsAccountIdCurrent: 'Current Account ID:',
  settingsAccountIdPlaceholder: 'Paste player URL or Account ID',
  settingsAccountIdHint: 'Example: https://tarkov.dev/players/regular/11302632',
  settingsAccountIdButton: 'Update account',
  settingsAccountIdUpdating: 'Updating...',
  settingsAccountIdUnbindTitle: 'Unbind AccountID',
  settingsAccountIdUnbindMessage: 'This will remove the linked AccountID from this device.',
  settingsAccountIdUnbindButton: 'Unbind AccountID',
  settingsAccountIdUnbindAction: 'Unbind',

  playerProfile: 'Player Profile',
  loadingProfile: 'Loading your profile...',
  failedToLoad: 'Failed to load profile',
  signOut: 'Sign Out',
  signOutConfirm: 'Sign Out',
  signOutConfirmMessage: 'Are you sure you want to sign out?',
  level: 'LVL',
  xp: 'XP',
  accountId: 'Player ID',
  prestige: 'Prestige',
  kd: 'K/D',
  survival: 'Survival',
  kills: 'Kills',
  raids: 'Raids',
  pmcStats: 'PMC Statistics',
  scavStats: 'Scav Statistics',
  totalRaids: 'Total Raids',
  survived: 'Survived',
  deaths: 'Deaths',
  kdRatio: 'K/D Ratio',
  survivalRate: 'Survival Rate',
  timeInRaids: 'Time in Raids',
  accountTime: 'Account Time:',
  lastActive: 'Last active:',
  profileUpdated: 'Profile updated:',
  achievementTotal: 'Total achievements',
  achievementRarityCommon: 'Common',
  achievementRarityRare: 'Rare',
  achievementRarityLegendary: 'Legendary',
  achievementRarityUnknown: 'Unknown',
  hideoutStash: 'Stash',
  exitKilled: 'Killed',
  exitLeft: 'Left early',
  exitMissing: 'MIA',
  exitRunThrough: 'Run-through',
  exitTransit: 'Transit',
  longestWinStreak: 'Longest win streak',

  searchHeaderSubtitle: 'ESCAPE FROM TARKOV',
  searchHeaderTitle: 'Item Search',
  searchPlaceholder: 'Search items by name',
  searchNoPlayers: 'No items found',
  searchNoPlayersSub: 'Try a different item name',
  searchForPlayer: 'Search for an item',
  searchUnknown: 'Unknown',
  searchDbLoaded: 'Ready to search items.',
  searchDbDefault: 'Enter an item name to search.',
  searchDownloading: 'Searching items...',
  searchDownloadingSub: 'Fetching results from tarkov.dev',
  searchFirstTime: 'Start typing to search items.',
  searchResults: 'results',
  searchTraderTitle: 'Traders',
  searchTraderPlaceholder: 'Search traders by name',
  searchNoTraders: 'No traders found',
  searchNoTradersSub: 'Try a different trader name',
  searchSortName: 'Name',
  searchSortPrice: 'Price',
  searchSortChange: '48h %',
  searchFilterAll: 'All',
  searchFilterType: 'Type',
  searchFilterCategory: 'Category',
  itemTypeLabels: {
    gun: 'Weapon',
    mods: 'Mods',
    preset: 'Preset',
    noFlea: 'No Flea',
    wearable: 'Wearable',
    suppressor: 'Suppressor',
    pistolGrip: 'Pistol Grip',
    ammo: 'Ammo',
    armor: 'Armor',
    rig: 'Rig',
    backpack: 'Backpack',
    helmet: 'Helmet',
    armband: 'Armband',
    meds: 'Meds',
    med: 'Meds',
    provisions: 'Provisions',
    food: 'Provisions',
    barter: 'Barter',
    keys: 'Keys',
    key: 'Key',
    container: 'Container',
  },
  itemPropertyLabels: {
    types: 'Types',
    class: 'Armor Class',
    caliber: 'Caliber',
    stackMaxSize: 'Stack Size',
    tracer: 'Tracer',
    ammoType: 'Ammo Type',
    projectileCount: 'Projectile Count',
    damage: 'Damage',
    armorDamage: 'Armor Damage',
    penetrationPower: 'Penetration',
    penetrationChance: 'Penetration Chance',
    fragmentationChance: 'Fragmentation Chance',
    ricochetChance: 'Ricochet Chance',
    penetrationPowerDeviation: 'Penetration Deviation',
    initialSpeed: 'Initial Speed',
    lightBleedModifier: 'Light Bleed Mod',
    heavyBleedModifier: 'Heavy Bleed Mod',
    durabilityBurnFactor: 'Durability Burn',
    heatFactor: 'Heat Factor',
    staminaBurnPerDamage: 'Stamina Burn / Damage',
    misfireChance: 'Misfire Chance',
    failureToFeedChance: 'Failure-to-Feed Chance',
    durability: 'Durability',
    maxDurability: 'Max Durability',
    armorType: 'Armor Type',
    armorZones: 'Armor Zones',
    headZones: 'Head Zones',
    capacity: 'Capacity',
    uses: 'Uses',
    useTime: 'Use Time',
    cures: 'Cures',
    hitpoints: 'Hitpoints',
    maxHealPerUse: 'Max Heal / Use',
    hpCostLightBleeding: 'HP Cost (Light Bleed)',
    hpCostHeavyBleeding: 'HP Cost (Heavy Bleed)',
    painkillerDuration: 'Painkiller Duration',
    energyImpact: 'Energy Impact',
    hydrationImpact: 'Hydration Impact',
    minLimbHealth: 'Min Limb Health',
    maxLimbHealth: 'Max Limb Health',
    energy: 'Energy',
    hydration: 'Hydration',
    units: 'Units',
    fireModes: 'Fire Modes',
    fireRate: 'Fire Rate',
    effectiveDistance: 'Effective Distance',
    recoilVertical: 'Vertical Recoil',
    recoilHorizontal: 'Horizontal Recoil',
    sightingRange: 'Sighting Range',
    repairCost: 'Repair Cost',
    speedPenalty: 'Speed Penalty',
    turnPenalty: 'Turn Penalty',
    ergoPenalty: 'Ergo Penalty',
    bluntThroughput: 'Blunt Throughput',
    blindnessProtection: 'Blindness Protection',
    blocksHeadset: 'Blocks Headset',
    deafening: 'Deafening',
    loadModifier: 'Load Modifier',
    ammoCheckModifier: 'Ammo Check Modifier',
    malfunctionChance: 'Malfunction Chance',
    grenadeType: 'Grenade Type',
    fuse: 'Fuse Time',
    minExplosionDistance: 'Min Explosion Distance',
    maxExplosionDistance: 'Max Explosion Distance',
    fragments: 'Fragments',
    contusionRadius: 'Contusion Radius',
  },
  itemSectionAttributes: 'Attributes',
  itemDetailsTitle: 'Item',
  itemSectionFlea: 'Flea Market',
  itemSectionBuy: 'Buy Prices',
  itemSectionTraders: 'Sell To Traders',
  itemSectionHistory: 'Flea History',
  itemPriceBase: 'Base Price',
  itemPriceFlea: 'Flea Price',
  itemPriceAvg24h: 'Avg 24h',
  itemPriceLastLow: 'Last Low',
  itemPriceChange48h: '48h Change',
  itemBuyFlea: 'Flea Market',
  itemNoBuyData: 'No buy prices',
  itemNoFleaData: 'No flea market data',
  itemNoTraderData: 'No trader prices',
  itemNoAttributes: 'No attributes',
  itemNoHistory: 'No price history',
  itemAttrWeight: 'Weight',
  itemAttrSize: 'Size',
  itemAttrErgo: 'Ergonomics',
  itemAttrRecoil: 'Recoil',
  itemAttrAccuracy: 'Accuracy',
  itemAttrLoudness: 'Loudness',
  itemAttrVelocity: 'Velocity',
  itemAttrBlocksHeadphones: 'Blocks Headphones',
  itemAttrFleaFee: 'Flea Fee',
  itemAttrMinFleaLevel: 'Min Flea Level',
  itemAttrOfferCount: 'Offers',
  itemHistoryTime: 'Time',
  itemHistoryPrice: 'Price',
  itemHistoryMin: 'Min',
  itemHistoryOffers: 'Offers',
  itemHistoryMinLabel: 'Min',
  itemHistoryMaxLabel: 'Max',
  itemHistoryLastLabel: 'Last',
  traderDetailsTitle: 'Trader',
  traderResetTime: 'Reset Time',
  traderDescription: 'Description',
  traderLevels: 'Trader Levels',
  traderRequiredPlayerLevel: 'Required Player Level',
  traderRequiredReputation: 'Required Reputation',
  traderRequiredCommerce: 'Required Commerce',
  traderUnlockConditions: 'Unlock Conditions',
  traderSellItems: 'Items for Sale',
  traderCashOffers: 'Cash Offers',
  traderBarterOffers: 'Barter Offers',
  traderNoOffers: 'No offers at this level',
  traderBuyLimit: 'Buy Limit',
  traderTaskUnlock: 'Task Unlock',
  traderBarterNeeds: 'Needs',

  tasksHeaderTitle: 'Tasks',
  tasksHeaderSubtitle: 'ESCAPE FROM TARKOV',
  tasksSearchPlaceholder: 'Search tasks by name',
  taskFilterTrader: 'Trader',
  taskFilterLevel: 'Level',
  taskFilterMap: 'Map',
  taskFilterFaction: 'Faction',
  taskFilter3x4Required: '3x4 Required',
  taskFilterLightkeeperRequired: 'Lightkeeper Required',
  tasksNoResults: 'No tasks found',
  tasksNoResultsSub: 'Try another task name or trader',
  tasksLoading: 'Loading tasks...',
  taskDetailsTitle: 'Task',
  taskSectionInfo: 'Task Info',
  taskSectionObjectives: 'Objectives',
  taskSectionFailConditions: 'Fail Conditions',
  taskSectionRequirements: 'Requirements',
  taskSectionRewards: 'Rewards',
  taskInfoTrader: 'Trader',
  taskInfoMap: 'Map',
  taskInfoLevel: 'Min Level',
  taskInfoExperience: 'Experience',
  taskInfoFaction: 'Faction',
  taskInfoKappa: 'Required for 3x4',
  taskInfoLightkeeper: 'Required for Lightkeeper',
  taskInfoRestartable: 'Restartable',
  taskAnyMap: 'Any map',
  taskAnyFaction: 'Any',
  taskNoObjectives: 'No objectives',
  taskNoFailConditions: 'No fail conditions',
  taskNoRequirements: 'No requirements',
  taskNoRewards: 'No rewards',
  taskRequiredTasks: 'Required tasks',
  taskRequiredStatus: 'Status',
  taskTraderRequirements: 'Trader requirements',
  taskTraderRequirementReputation: 'Reputation',
  taskCompareLessOrEqual: 'Less than or equal to',
  taskRewardStart: 'On Start',
  taskRewardFinish: 'On Completion',
  taskRewardFailure: 'On Failure',
  taskRewardItems: 'Items',
  taskRewardExperience: 'Experience',
  taskRewardStanding: 'Trader standing',
  taskRewardSkills: 'Skill rewards',
  taskObjectiveShowMore: 'Show more',
  taskObjectiveShowLess: 'Show less',
  taskObjectiveOptional: 'Optional',
  taskOpenWiki: 'Open Wiki',
  taskTag3x4: '3x4 Required',
  taskTagLightkeeper: 'Lightkeeper',

  hintKD: 'Avg 24h',
  hintSurvival: 'Last Low',
  hintSkills: 'Category',
  skillsTitle: 'Skills',

  playerNameInvalidChars: 'Names can only contain letters, numbers, dashes (-), and underscores (_)',
  playerNameInvalidLength: 'Name must be 3-15 characters, or TarkovCitizen followed by numbers',

  setupTitle: 'Link Your Player',
  setupSubtitle: 'Open the players page, go to your profile, and paste the URL or Account ID here.',
  setupOpenPlayers: 'Open tarkov.dev players',
  setupAccountIdLabel: 'Account ID',
  setupAccountIdPlaceholder: 'Paste player URL or Account ID',
  setupAccountIdHint: 'Example: https://tarkov.dev/players/regular/11302632',
  setupLinkButton: 'Link account',
  setupInvalidAccountId: 'Paste a player URL or numbers-only Account ID',
  setupFetchingProfile: 'Fetching profile...',

  loadout: 'Loadout',
  noLoadout: 'No loadout data available',
  slotPrimary: 'Primary',
  slotSecondary: 'Secondary',
  slotSidearm: 'Sidearm',
  slotArmor: 'Armor',
  slotRig: 'Rig',
  slotBackpack: 'Backpack',
  slotSecure: 'Secure',
  slotScabbard: 'Melee',
  slotArmband: 'Armband',
  slotHeadwear: 'Headwear',
  slotEarpiece: 'Earpiece',
  slotFaceCover: 'Face Cover',
  slotEyewear: 'Eyewear',
};

const zh: Translations = {
  back: '返回',
  retry: '重试',
  cancel: '取消',
  save: '保存',
  clear: '清除',
  apply: '应用',
  none: '无',
  yes: '是',
  no: '否',
  overview: '概览',
  achievements: '成就',
  noAchievements: '暂无成就',
  favoriteItems: '收藏物品',
  noFavoriteItems: '暂无收藏',
  hideout: '藏身处',
  noHideout: '暂无藏身处数据',
  reorderSection: '调整分组顺序',
  reorderHint: '按住左侧按钮拖动排序',
  moveUp: '上移',
  moveDown: '下移',
  moveTop: '置顶',
  moveBottom: '置底',
  notFoundTitle: '页面不存在',
  notFoundLink: '返回首页',

  tabMyProfile: '我的资料',
  tabSearch: '搜索',
  tabTasks: '任务',
  tabSettings: '设置',

  settingsTitle: '设置',
  language: '语言',
  languageValueEn: 'English',
  languageValueZh: '中文',
  languageValueRu: 'Русский',
  defaultPlayerName: '默认玩家名称',
  defaultPlayerNamePlaceholder: '输入玩家名称',
  defaultPlayerNameHint: '用于预填搜索框。',
  turnstileToken: 'Turnstile 令牌',
  turnstileTokenPlaceholder: '粘贴来自 tarkov.dev 的 token',
  turnstileTokenHint: '可选。若被 Turnstile 拦截，需要填写。',
  turnstileTokenHelp: '打开玩家页面完成 Turnstile，然后从请求地址中复制 token=...。',
  turnstileOpenPlayers: '打开 tarkov.dev 玩家页',
  settingsAccountIdTitle: '账户ID',
  settingsAccountIdCurrent: '当前账户ID：',
  settingsAccountIdPlaceholder: '粘贴玩家 URL 或账户ID',
  settingsAccountIdHint: '示例：https://tarkov.dev/players/regular/11302632',
  settingsAccountIdButton: '更新账户',
  settingsAccountIdUpdating: '正在更新...',
  settingsAccountIdUnbindTitle: '解绑账户',
  settingsAccountIdUnbindMessage: '这会从当前设备移除已绑定的账户。',
  settingsAccountIdUnbindButton: '解绑账户',
  settingsAccountIdUnbindAction: '解绑',

  playerProfile: '玩家资料',
  loadingProfile: '正在加载你的资料...',
  failedToLoad: '加载资料失败',
  signOut: '退出登录',
  signOutConfirm: '退出登录',
  signOutConfirmMessage: '确定要退出登录吗？',
  level: '等级',
  xp: '经验值',
  accountId: '玩家编号',
  prestige: '声望',
  kd: '击杀比',
  survival: '存活率',
  kills: '击杀',
  raids: '战局',
  pmcStats: 'PMC 数据',
  scavStats: 'Scav 数据',
  totalRaids: '总战局数',
  survived: '存活',
  deaths: '死亡',
  kdRatio: '击杀比',
  survivalRate: '存活率',
  timeInRaids: '战局总时长',
  accountTime: '账号时长:',
  lastActive: '最近活跃:',
  profileUpdated: '资料更新:',
  achievementTotal: '成就总数',
  achievementRarityCommon: '普通',
  achievementRarityRare: '稀有',
  achievementRarityLegendary: '传奇',
  achievementRarityUnknown: '未知',
  hideoutStash: '仓库升级',
  exitKilled: '阵亡',
  exitLeft: '中途离开',
  exitMissing: '失踪',
  exitRunThrough: '跑刀撤离',
  exitTransit: '中转撤离',
  longestWinStreak: '最长连胜',

  searchHeaderSubtitle: '逃离塔科夫',
  searchHeaderTitle: '物品搜索',
  searchPlaceholder: '输入物品名称',
  searchNoPlayers: '未找到物品',
  searchNoPlayersSub: '尝试其他物品名称',
  searchForPlayer: '搜索物品',
  searchUnknown: '未知',
  searchDbLoaded: '可以开始搜索物品。',
  searchDbDefault: '输入物品名称进行搜索。',
  searchDownloading: '正在搜索物品...',
  searchDownloadingSub: '从 tarkov.dev 获取结果',
  searchFirstTime: '输入名称开始搜索。',
  searchResults: '个结果',
  searchTraderTitle: '商人',
  searchTraderPlaceholder: '输入商人名称',
  searchNoTraders: '未找到商人',
  searchNoTradersSub: '尝试其他商人名称',
  searchSortName: '名称',
  searchSortPrice: '价格',
  searchSortChange: '48h 涨幅',
  searchFilterAll: '全部',
  searchFilterType: '类型',
  searchFilterCategory: '分类',
  itemTypeLabels: {
    gun: '武器',
    mods: '改装件',
    preset: '预设',
    noFlea: '无法上架至跳蚤',
    wearable: '穿戴',
    suppressor: '消音器',
    pistolGrip: '手枪式握把',
    ammo: '弹药',
    armor: '护甲',
    rig: '胸挂',
    backpack: '背包',
    helmet: '头盔',
    armband: '臂章',
    meds: '医疗',
    med: '医疗',
    provisions: '补给',
    food: '食物',
    barter: '交换品',
    keys: '钥匙',
    key: '钥匙',
    container: '容器',
  },
  itemPropertyLabels: {
    types: '类型',
    class: '护甲等级',
    caliber: '口径',
    stackMaxSize: '堆叠上限',
    tracer: '曳光',
    ammoType: '弹药类型',
    projectileCount: '投射物数量',
    damage: '伤害',
    armorDamage: '护甲伤害',
    penetrationPower: '穿透值',
    penetrationChance: '穿透概率',
    fragmentationChance: '破片概率',
    ricochetChance: '跳弹概率',
    penetrationPowerDeviation: '穿透偏差',
    initialSpeed: '初速',
    lightBleedModifier: '轻出血修正',
    heavyBleedModifier: '重出血修正',
    durabilityBurnFactor: '耐久损耗系数',
    heatFactor: '过热系数',
    staminaBurnPerDamage: '每点伤害体力消耗',
    misfireChance: '哑火概率',
    failureToFeedChance: '供弹故障概率',
    durability: '耐久',
    maxDurability: '最大耐久',
    armorType: '护甲类型',
    armorZones: '防护部位',
    headZones: '头部防护区域',
    capacity: '容量',
    uses: '使用次数',
    useTime: '使用时间',
    cures: '可治疗效果',
    hitpoints: '生命值',
    maxHealPerUse: '单次最大治疗',
    hpCostLightBleeding: '止轻出血生命消耗',
    hpCostHeavyBleeding: '止重出血生命消耗',
    painkillerDuration: '止痛时长',
    energyImpact: '能量影响',
    hydrationImpact: '水分影响',
    minLimbHealth: '最低肢体生命',
    maxLimbHealth: '最高肢体生命',
    energy: '能量',
    hydration: '水分',
    units: '剩余单位',
    fireModes: '开火模式',
    fireRate: '射速',
    effectiveDistance: '有效距离',
    recoilVertical: '垂直后坐',
    recoilHorizontal: '水平后坐',
    sightingRange: '瞄准距离',
    repairCost: '维修成本',
    speedPenalty: '移速惩罚',
    turnPenalty: '转向惩罚',
    ergoPenalty: '人机惩罚',
    bluntThroughput: '钝伤穿透',
    blindnessProtection: '致盲防护',
    blocksHeadset: '阻挡耳机',
    deafening: '闷耳效果',
    loadModifier: '装填修正',
    ammoCheckModifier: '验弹修正',
    malfunctionChance: '故障概率',
    grenadeType: '手雷类型',
    fuse: '引信时间',
    minExplosionDistance: '最小爆炸距离',
    maxExplosionDistance: '最大爆炸距离',
    fragments: '破片数量',
    contusionRadius: '震荡半径',
  },
  itemSectionAttributes: '属性',
  itemDetailsTitle: '物品',
  itemSectionFlea: '跳蚤市场',
  itemSectionBuy: '购买价格',
  itemSectionTraders: '卖给商人',
  itemSectionHistory: '跳蚤历史',
  itemPriceBase: '基准价格',
  itemPriceFlea: '跳蚤价',
  itemPriceAvg24h: '24h 均价',
  itemPriceLastLow: '最低价',
  itemPriceChange48h: '48h 涨幅',
  itemBuyFlea: '跳蚤市场',
  itemNoBuyData: '暂无购买价格',
  itemNoFleaData: '暂无跳蚤市场数据',
  itemNoTraderData: '暂无商人收购价',
  itemNoAttributes: '暂无属性',
  itemNoHistory: '暂无历史价格',
  itemAttrWeight: '重量',
  itemAttrSize: '尺寸',
  itemAttrErgo: '人机功效',
  itemAttrRecoil: '后坐力',
  itemAttrAccuracy: '精准度',
  itemAttrLoudness: '响度',
  itemAttrVelocity: '初速',
  itemAttrBlocksHeadphones: '阻挡耳机',
  itemAttrFleaFee: '跳蚤手续费',
  itemAttrMinFleaLevel: '跳蚤等级',
  itemAttrOfferCount: '在售数量',
  itemHistoryTime: '时间',
  itemHistoryPrice: '价格',
  itemHistoryMin: '最低',
  itemHistoryOffers: '在售',
  itemHistoryMinLabel: '最低',
  itemHistoryMaxLabel: '最高',
  itemHistoryLastLabel: '最新',
  traderDetailsTitle: '商人',
  traderResetTime: '刷新时间',
  traderDescription: '简介',
  traderLevels: '商人等级',
  traderRequiredPlayerLevel: '要求玩家等级',
  traderRequiredReputation: '要求好感度',
  traderRequiredCommerce: '要求交易额',
  traderUnlockConditions: '解锁条件',
  traderSellItems: '可购买物品',
  traderCashOffers: '现金购买',
  traderBarterOffers: '以物易物',
  traderNoOffers: '该等级暂无可购买物品',
  traderBuyLimit: '限购',
  traderTaskUnlock: '任务解锁',
  traderBarterNeeds: '兑换需要',

  tasksHeaderTitle: '任务',
  tasksHeaderSubtitle: '逃离塔科夫',
  tasksSearchPlaceholder: '输入任务名称',
  taskFilterTrader: '商人',
  taskFilterLevel: '等级',
  taskFilterMap: '地图',
  taskFilterFaction: '阵营',
  taskFilter3x4Required: '3x4必须',
  taskFilterLightkeeperRequired: '灯塔商人必须',
  tasksNoResults: '未找到任务',
  tasksNoResultsSub: '尝试其他任务名称或商人',
  tasksLoading: '正在加载任务...',
  taskDetailsTitle: '任务',
  taskSectionInfo: '任务信息',
  taskSectionObjectives: '任务目标',
  taskSectionFailConditions: '失败条件',
  taskSectionRequirements: '解锁条件',
  taskSectionRewards: '任务奖励',
  taskInfoTrader: '发布商人',
  taskInfoMap: '地图',
  taskInfoLevel: '最低等级',
  taskInfoExperience: '经验奖励',
  taskInfoFaction: '阵营',
  taskInfoKappa: '3x4必须',
  taskInfoLightkeeper: '灯塔商人必须',
  taskInfoRestartable: '可重复',
  taskAnyMap: '任意地图',
  taskAnyFaction: '任意',
  taskNoObjectives: '暂无目标',
  taskNoFailConditions: '无失败条件',
  taskNoRequirements: '无解锁条件',
  taskNoRewards: '无奖励',
  taskRequiredTasks: '前置任务',
  taskRequiredStatus: '状态',
  taskTraderRequirements: '商人条件',
  taskTraderRequirementReputation: '好感度',
  taskCompareLessOrEqual: '小于等于',
  taskRewardStart: '开始时',
  taskRewardFinish: '完成时',
  taskRewardFailure: '失败时',
  taskRewardItems: '物品',
  taskRewardExperience: '经验',
  taskRewardStanding: '商人好感',
  taskRewardSkills: '技能奖励',
  taskObjectiveShowMore: '展开',
  taskObjectiveShowLess: '收起',
  taskObjectiveOptional: '可选任务',
  taskOpenWiki: '打开 Wiki',
  taskTag3x4: '3x4必须',
  taskTagLightkeeper: '灯塔商人',

  hintKD: '24h 均价',
  hintSurvival: '最低价',
  hintSkills: '分类',
  skillsTitle: '技能',

  playerNameInvalidChars: '名称只能包含字母、数字、短横线 (-) 和下划线 (_)',
  playerNameInvalidLength: '名称需为 3-15 个字符，或 TarkovCitizen 加数字',

  setupTitle: '绑定你的角色',
  setupSubtitle: '打开玩家页面进入你的资料，然后粘贴 URL 或账户 ID。',
  setupOpenPlayers: '打开 tarkov.dev 玩家页',
  setupAccountIdLabel: '账户ID',
  setupAccountIdPlaceholder: '粘贴玩家 URL 或账户ID',
  setupAccountIdHint: '示例：https://tarkov.dev/players/regular/11302632',
  setupLinkButton: '绑定账户',
  setupInvalidAccountId: '请粘贴玩家 URL 或仅数字账户ID',
  setupFetchingProfile: '正在获取资料...',

  loadout: '装备',
  noLoadout: '暂无装备数据',
  slotPrimary: '主武器',
  slotSecondary: '副武器',
  slotSidearm: '手枪',
  slotArmor: '护甲',
  slotRig: '战术背心',
  slotBackpack: '背包',
  slotSecure: '安全箱',
  slotScabbard: '近战武器',
  slotArmband: '臂章',
  slotHeadwear: '头盔',
  slotEarpiece: '耳机',
  slotFaceCover: '面罩',
  slotEyewear: '眼镜',
};

const ru: Translations = {
  ...en,
  back: 'Назад',
  retry: 'Повторить',
  cancel: 'Отмена',
  save: 'Сохранить',
  clear: 'Очистить',
  apply: 'Применить',
  none: 'Нет',
  yes: 'Да',
  no: 'Нет',
  overview: 'Обзор',
  achievements: 'Достижения',
  noAchievements: 'Пока нет достижений',
  favoriteItems: 'Любимые предметы',
  noFavoriteItems: 'Нет любимых предметов',
  hideout: 'Убежище',
  noHideout: 'Нет данных убежища',
  reorderSection: 'Порядок блоков',
  reorderHint: 'Зажмите ручку, чтобы изменить порядок',
  moveUp: 'Вверх',
  moveDown: 'Вниз',
  moveTop: 'В начало',
  moveBottom: 'В конец',
  notFoundTitle: 'Страница не найдена',
  notFoundLink: 'На главную',

  tabMyProfile: 'Мой профиль',
  tabSearch: 'Поиск',
  tabTasks: 'Задания',
  tabSettings: 'Настройки',

  settingsTitle: 'Настройки',
  language: 'Язык',
  languageValueEn: 'English',
  languageValueZh: '中文',
  languageValueRu: 'Русский',
  defaultPlayerName: 'Имя игрока по умолчанию',
  defaultPlayerNamePlaceholder: 'Введите имя игрока',
  defaultPlayerNameHint: 'Используется для автозаполнения поиска.',
  turnstileToken: 'Токен Turnstile',
  turnstileTokenPlaceholder: 'Вставьте токен с tarkov.dev',
  turnstileTokenHint: 'Необязательно. Нужен, если поиск блокируется Turnstile.',
  turnstileTokenHelp: 'Откройте страницу игроков, пройдите Turnstile и скопируйте token=... из URL запроса.',
  turnstileOpenPlayers: 'Открыть игроков tarkov.dev',
  settingsAccountIdTitle: 'Account ID',
  settingsAccountIdCurrent: 'Текущий Account ID:',
  settingsAccountIdPlaceholder: 'Вставьте URL игрока или Account ID',
  settingsAccountIdHint: 'Пример: https://tarkov.dev/players/regular/11302632',
  settingsAccountIdButton: 'Обновить аккаунт',
  settingsAccountIdUpdating: 'Обновление...',
  settingsAccountIdUnbindTitle: 'Отвязать AccountID',
  settingsAccountIdUnbindMessage: 'Это удалит привязанный AccountID с этого устройства.',
  settingsAccountIdUnbindButton: 'Отвязать AccountID',
  settingsAccountIdUnbindAction: 'Отвязать',

  playerProfile: 'Профиль игрока',
  loadingProfile: 'Загрузка профиля...',
  failedToLoad: 'Не удалось загрузить профиль',
  signOut: 'Выйти',
  signOutConfirm: 'Выход',
  signOutConfirmMessage: 'Вы уверены, что хотите выйти?',
  level: 'УРОВ.',
  xp: 'XP',
  accountId: 'ID игрока',
  prestige: 'Престиж',
  kd: 'K/D',
  survival: 'Выживаемость',
  kills: 'Убийства',
  raids: 'Рейды',
  pmcStats: 'Статистика PMC',
  scavStats: 'Статистика Scav',
  totalRaids: 'Всего рейдов',
  survived: 'Выжил',
  deaths: 'Смерти',
  kdRatio: 'K/D',
  survivalRate: 'Процент выживания',
  timeInRaids: 'Время в рейдах',
  accountTime: 'Время аккаунта:',
  lastActive: 'Последняя активность:',
  profileUpdated: 'Профиль обновлён:',
  achievementTotal: 'Всего достижений',
  achievementRarityCommon: 'Обычная',
  achievementRarityRare: 'Редкая',
  achievementRarityLegendary: 'Легендарная',
  achievementRarityUnknown: 'Неизвестно',
  hideoutStash: 'Хранилище',
  exitKilled: 'Погиб',
  exitLeft: 'Покинул рейд',
  exitMissing: 'Пропал без вести',
  exitRunThrough: 'Ранний выход',
  exitTransit: 'Транзит',
  longestWinStreak: 'Лучшая серия побед',

  searchHeaderSubtitle: 'ESCAPE FROM TARKOV',
  searchHeaderTitle: 'Поиск предметов',
  searchPlaceholder: 'Введите название предмета',
  searchNoPlayers: 'Ничего не найдено',
  searchNoPlayersSub: 'Попробуйте другое название',
  searchForPlayer: 'Поиск предмета',
  searchUnknown: 'Неизвестно',
  searchDbLoaded: 'Готово к поиску предметов.',
  searchDbDefault: 'Введите название предмета для поиска.',
  searchDownloading: 'Поиск предметов...',
  searchDownloadingSub: 'Получение данных с tarkov.dev',
  searchFirstTime: 'Начните вводить название предмета.',
  searchResults: 'результатов',
  searchTraderTitle: 'Торговцы',
  searchTraderPlaceholder: 'Поиск торговца по имени',
  searchNoTraders: 'Торговцы не найдены',
  searchNoTradersSub: 'Попробуйте другое имя торговца',
  searchSortName: 'Название',
  searchSortPrice: 'Цена',
  searchSortChange: '48ч %',
  searchFilterAll: 'Все',
  searchFilterType: 'Тип',
  searchFilterCategory: 'Категория',
  itemTypeLabels: {
    ...en.itemTypeLabels,
    gun: 'Оружие',
    mods: 'Модификации',
    preset: 'Пресет',
    noFlea: 'Без барахолки',
    wearable: 'Снаряжение',
    suppressor: 'Глушитель',
    pistolGrip: 'Пистолетная рукоятка',
    ammo: 'Патроны',
    armor: 'Броня',
    rig: 'Разгрузка',
    backpack: 'Рюкзак',
    helmet: 'Шлем',
    armband: 'Повязка',
    meds: 'Медицина',
    med: 'Медицина',
    provisions: 'Провизия',
    food: 'Провизия',
    barter: 'Бартер',
    keys: 'Ключи',
    key: 'Ключ',
    container: 'Контейнер',
  },
  itemPropertyLabels: {
    types: 'Типы',
    class: 'Класс брони',
    caliber: 'Калибр',
    stackMaxSize: 'Макс. стак',
    tracer: 'Трассер',
    ammoType: 'Тип боеприпаса',
    projectileCount: 'Кол-во снарядов',
    damage: 'Урон',
    armorDamage: 'Урон по броне',
    penetrationPower: 'Пробитие',
    penetrationChance: 'Шанс пробития',
    fragmentationChance: 'Шанс фрагментации',
    ricochetChance: 'Шанс рикошета',
    penetrationPowerDeviation: 'Отклонение пробития',
    initialSpeed: 'Начальная скорость',
    lightBleedModifier: 'Модиф. лёгкого кровотечения',
    heavyBleedModifier: 'Модиф. сильного кровотечения',
    durabilityBurnFactor: 'Износ прочности',
    heatFactor: 'Фактор нагрева',
    staminaBurnPerDamage: 'Расход выносливости за урон',
    misfireChance: 'Шанс осечки',
    failureToFeedChance: 'Шанс неподачи',
    durability: 'Прочность',
    maxDurability: 'Макс. прочность',
    armorType: 'Тип брони',
    armorZones: 'Зоны защиты',
    headZones: 'Зоны головы',
    capacity: 'Вместимость',
    uses: 'Использований',
    useTime: 'Время применения',
    cures: 'Лечит эффекты',
    hitpoints: 'Очки здоровья',
    maxHealPerUse: 'Макс. лечение за применение',
    hpCostLightBleeding: 'Цена HP за лёгкое кровотечение',
    hpCostHeavyBleeding: 'Цена HP за сильное кровотечение',
    painkillerDuration: 'Длительность обезболивания',
    energyImpact: 'Влияние на энергию',
    hydrationImpact: 'Влияние на воду',
    minLimbHealth: 'Мин. здоровье конечности',
    maxLimbHealth: 'Макс. здоровье конечности',
    energy: 'Энергия',
    hydration: 'Гидратация',
    units: 'Единицы',
    fireModes: 'Режимы огня',
    fireRate: 'Скорострельность',
    effectiveDistance: 'Эффективная дальность',
    recoilVertical: 'Вертикальная отдача',
    recoilHorizontal: 'Горизонтальная отдача',
    sightingRange: 'Дальность прицеливания',
    repairCost: 'Стоимость ремонта',
    speedPenalty: 'Штраф скорости',
    turnPenalty: 'Штраф поворота',
    ergoPenalty: 'Штраф эргономики',
    bluntThroughput: 'Передача тупого урона',
    blindnessProtection: 'Защита от ослепления',
    blocksHeadset: 'Блокирует гарнитуру',
    deafening: 'Оглушение',
    loadModifier: 'Модиф. зарядки',
    ammoCheckModifier: 'Модиф. проверки патрона',
    malfunctionChance: 'Шанс неисправности',
    grenadeType: 'Тип гранаты',
    fuse: 'Взрыватель',
    minExplosionDistance: 'Мин. дистанция взрыва',
    maxExplosionDistance: 'Макс. дистанция взрыва',
    fragments: 'Осколки',
    contusionRadius: 'Радиус контузии',
  },
  itemSectionAttributes: 'Характеристики',
  itemDetailsTitle: 'Предмет',
  itemSectionFlea: 'Барахолка',
  itemSectionBuy: 'Цены покупки',
  itemSectionTraders: 'Продажа торговцам',
  itemSectionHistory: 'История барахолки',
  itemPriceBase: 'Базовая цена',
  itemPriceFlea: 'Цена барахолки',
  itemPriceAvg24h: 'Средняя 24ч',
  itemPriceLastLow: 'Последний минимум',
  itemPriceChange48h: 'Изменение 48ч',
  itemBuyFlea: 'Барахолка',
  itemNoBuyData: 'Нет данных о покупке',
  itemNoFleaData: 'Нет данных барахолки',
  itemNoTraderData: 'Нет цен торговцев',
  itemNoAttributes: 'Нет характеристик',
  itemNoHistory: 'Нет истории цен',
  itemAttrWeight: 'Вес',
  itemAttrSize: 'Размер',
  itemAttrErgo: 'Эргономика',
  itemAttrRecoil: 'Отдача',
  itemAttrAccuracy: 'Точность',
  itemAttrLoudness: 'Громкость',
  itemAttrVelocity: 'Скорость',
  itemAttrBlocksHeadphones: 'Блокирует наушники',
  itemAttrFleaFee: 'Комиссия барахолки',
  itemAttrMinFleaLevel: 'Мин. уровень барахолки',
  itemAttrOfferCount: 'Предложений',
  itemHistoryTime: 'Время',
  itemHistoryPrice: 'Цена',
  itemHistoryMin: 'Мин',
  itemHistoryOffers: 'Предложения',
  itemHistoryMinLabel: 'Мин',
  itemHistoryMaxLabel: 'Макс',
  itemHistoryLastLabel: 'Последняя',
  traderDetailsTitle: 'Торговец',
  traderResetTime: 'Время сброса',
  traderDescription: 'Описание',
  traderLevels: 'Уровни торговца',
  traderRequiredPlayerLevel: 'Требуемый уровень игрока',
  traderRequiredReputation: 'Требуемая репутация',
  traderRequiredCommerce: 'Требуемый оборот',
  traderUnlockConditions: 'Условия открытия',
  traderSellItems: 'Товары в продаже',
  traderCashOffers: 'За деньги',
  traderBarterOffers: 'Бартер',
  traderNoOffers: 'На этом уровне предложений нет',
  traderBuyLimit: 'Лимит покупки',
  traderTaskUnlock: 'Разблокируется заданием',
  traderBarterNeeds: 'Нужно для обмена',

  tasksHeaderTitle: 'Задания',
  tasksHeaderSubtitle: 'ESCAPE FROM TARKOV',
  tasksSearchPlaceholder: 'Поиск задания по названию',
  taskFilterTrader: 'Торговец',
  taskFilterLevel: 'Уровень',
  taskFilterMap: 'Карта',
  taskFilterFaction: 'Фракция',
  taskFilter3x4Required: 'Нужно для 3x4',
  taskFilterLightkeeperRequired: 'Нужно для Смотрителя',
  tasksNoResults: 'Задания не найдены',
  tasksNoResultsSub: 'Попробуйте другое название или торговца',
  tasksLoading: 'Загрузка заданий...',
  taskDetailsTitle: 'Задание',
  taskSectionInfo: 'Информация',
  taskSectionObjectives: 'Цели',
  taskSectionFailConditions: 'Условия провала',
  taskSectionRequirements: 'Требования',
  taskSectionRewards: 'Награды',
  taskInfoTrader: 'Торговец',
  taskInfoMap: 'Карта',
  taskInfoLevel: 'Мин. уровень',
  taskInfoExperience: 'Опыт',
  taskInfoFaction: 'Фракция',
  taskInfoKappa: 'Нужно для 3x4',
  taskInfoLightkeeper: 'Нужно для Lightkeeper',
  taskInfoRestartable: 'Повторяемое',
  taskAnyMap: 'Любая карта',
  taskAnyFaction: 'Любая',
  taskNoObjectives: 'Нет целей',
  taskNoFailConditions: 'Нет условий провала',
  taskNoRequirements: 'Нет требований',
  taskNoRewards: 'Нет наград',
  taskRequiredTasks: 'Предыдущие задания',
  taskRequiredStatus: 'Статус',
  taskTraderRequirements: 'Требования торговца',
  taskTraderRequirementReputation: 'Репутация',
  taskCompareLessOrEqual: 'Меньше или равно',
  taskRewardStart: 'В начале',
  taskRewardFinish: 'По завершении',
  taskRewardFailure: 'При провале',
  taskRewardItems: 'Предметы',
  taskRewardExperience: 'Опыт',
  taskRewardStanding: 'Репутация',
  taskRewardSkills: 'Навыки',
  taskObjectiveShowMore: 'Показать',
  taskObjectiveShowLess: 'Свернуть',
  taskObjectiveOptional: 'Необязательно',
  taskOpenWiki: 'Открыть Wiki',
  taskTag3x4: 'Нужно для 3x4',
  taskTagLightkeeper: 'Смотритель',

  hintKD: 'Сред. 24ч',
  hintSurvival: 'Последний минимум',
  hintSkills: 'Категория',
  skillsTitle: 'Навыки',

  playerNameInvalidChars: 'Имя может содержать только буквы, цифры, дефис (-) и подчёркивание (_)',
  playerNameInvalidLength: 'Имя должно быть 3-15 символов или TarkovCitizen + цифры',

  setupTitle: 'Привязка игрока',
  setupSubtitle: 'Откройте страницу игроков, перейдите в профиль и вставьте URL или Account ID.',
  setupOpenPlayers: 'Открыть игроков tarkov.dev',
  setupAccountIdLabel: 'Account ID',
  setupAccountIdPlaceholder: 'Вставьте URL игрока или Account ID',
  setupAccountIdHint: 'Пример: https://tarkov.dev/players/regular/11302632',
  setupLinkButton: 'Привязать аккаунт',
  setupInvalidAccountId: 'Вставьте URL игрока или числовой Account ID',
  setupFetchingProfile: 'Загрузка профиля...',

  loadout: 'Снаряжение',
  noLoadout: 'Нет данных о снаряжении',
  slotPrimary: 'Основное',
  slotSecondary: 'Вторичное',
  slotSidearm: 'Пистолет',
  slotArmor: 'Броня',
  slotRig: 'Разгрузка',
  slotBackpack: 'Рюкзак',
  slotSecure: 'Подсумок',
  slotScabbard: 'Ближний бой',
  slotArmband: 'Повязка',
  slotHeadwear: 'Головной убор',
  slotEarpiece: 'Наушники',
  slotFaceCover: 'Маска',
  slotEyewear: 'Очки',
};

export const translations: Record<Language, Translations> = { en, zh, ru };
