export type Language = 'en' | 'zh';

export interface Translations {
  // Common
  back: string;
  retry: string;
  cancel: string;
  signOut: string;
  search: string;
  loading: string;

  // Login
  loginSubtitle: string;
  loginTitle: string;
  loginDescription: string;
  getStarted: string;
  loginFooter: string;

  // Setup
  setupTitle: string;
  setupSubtitle: string;
  setupPlaceholder: string;
  setupSearchButton: string;
  setupSelectPlayer: string;
  setupNoPlayers: string;

  // Tabs
  tabMyProfile: string;
  tabSearch: string;

  // Profile
  loadingProfile: string;
  failedToLoad: string;
  signOutConfirm: string;
  signOutConfirmMessage: string;

  // Search
  searchHeaderSubtitle: string;
  searchHeaderTitle: string;
  searchPlaceholder: string;
  searchNoPlayers: string;
  searchNoPlayersSub: string;
  searchForPlayer: string;
  searchDbLoaded: string;
  searchDbDefault: string;
  searchDownloading: string;
  searchDownloadingSub: string;
  searchFirstTime: string;
  searchResults: string;

  // Hints
  hintKD: string;
  hintSurvival: string;
  hintSkills: string;

  // Player Profile View
  playerProfile: string;
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

  // Loadout
  loadout: string;
  noLoadout: string;

  // Skills
  skills: string;

  // Not found
  notFoundTitle: string;
  notFoundLink: string;

  // Language
  language: string;
  switchLang: string;

  // Slot names
  slotPrimary: string;
  slotSecondary: string;
  slotSidearm: string;
  slotArmor: string;
  slotRig: string;
  slotFaceCover: string;
  slotSecure: string;
  slotArmband: string;
}

const en: Translations = {
  back: 'Back',
  retry: 'Retry',
  cancel: 'Cancel',
  signOut: 'Sign Out',
  search: 'Search',
  loading: 'Loading...',

  loginSubtitle: 'ESCAPE FROM TARKOV',
  loginTitle: 'Player Stats',
  loginDescription: 'Track your raids, K/D ratio, survival rate,\nand skills progression.',
  getStarted: 'Get Started',
  loginFooter: 'View any player\'s stats from tarkov.dev',

  setupTitle: 'Link Your Player',
  setupSubtitle: 'Search your Tarkov player name to link\nyour profile for quick access.',
  setupPlaceholder: 'Your Tarkov player name',
  setupSearchButton: 'Search',
  setupSelectPlayer: 'Select your player',
  setupNoPlayers: 'No players found',

  tabMyProfile: 'My Profile',
  tabSearch: 'Search',

  loadingProfile: 'Loading your profile...',
  failedToLoad: 'Failed to load profile',
  signOutConfirm: 'Sign Out',
  signOutConfirmMessage: 'Are you sure you want to sign out?',

  searchHeaderSubtitle: 'ESCAPE FROM TARKOV',
  searchHeaderTitle: 'Player Lookup',
  searchPlaceholder: 'Player name or Account ID',
  searchNoPlayers: 'No players found',
  searchNoPlayersSub: 'Try a different name or enter an Account ID directly',
  searchForPlayer: 'Search for a player',
  searchDbLoaded: 'Database loaded! Enter a player name to search.',
  searchDbDefault: 'Enter a player name to search the database,\nor enter an Account ID to view directly.',
  searchDownloading: 'Downloading player database...',
  searchDownloadingSub: 'First search may take 10-30s due to database size (~66MB).\nSubsequent searches will be instant.',
  searchFirstTime: 'Downloading ~66MB database in background.\nYou can search once it finishes.',
  searchResults: 'results',

  hintKD: 'K/D Ratio',
  hintSurvival: 'Survival Rate',
  hintSkills: 'Skills',

  playerProfile: 'Player Profile',
  xp: 'XP',
  accountId: 'Account ID',
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

  loadout: 'Loadout',
  noLoadout: 'No loadout data available',

  skills: 'Skills',

  notFoundTitle: "This screen doesn't exist.",
  notFoundLink: 'Go to home screen!',

  language: 'Language',
  switchLang: 'English',

  slotPrimary: 'Primary',
  slotSecondary: 'Secondary',
  slotSidearm: 'Sidearm',
  slotArmor: 'Armor',
  slotRig: 'Rig',
  slotFaceCover: 'Face Cover',
  slotSecure: 'Secure',
  slotArmband: 'Armband',
};

const zh: Translations = {
  back: '返回',
  retry: '重试',
  cancel: '取消',
  signOut: '退出登录',
  search: '搜索',
  loading: '加载中...',

  loginSubtitle: '逃离塔科夫',
  loginTitle: '玩家数据',
  loginDescription: '追踪你的战局、击杀比、存活率\n和技能进度。',
  getStarted: '开始使用',
  loginFooter: '查看 tarkov.dev 上任意玩家的数据',

  setupTitle: '绑定你的角色',
  setupSubtitle: '搜索你的塔科夫玩家名称\n以绑定你的个人资料。',
  setupPlaceholder: '你的塔科夫玩家名称',
  setupSearchButton: '搜索',
  setupSelectPlayer: '选择你的角色',
  setupNoPlayers: '未找到玩家',

  tabMyProfile: '我的资料',
  tabSearch: '搜索',

  loadingProfile: '正在加载你的资料...',
  failedToLoad: '加载资料失败',
  signOutConfirm: '退出登录',
  signOutConfirmMessage: '确定要退出登录吗？',

  searchHeaderSubtitle: '逃离塔科夫',
  searchHeaderTitle: '玩家查询',
  searchPlaceholder: '玩家名称或账户ID',
  searchNoPlayers: '未找到玩家',
  searchNoPlayersSub: '尝试其他名称或直接输入账户ID',
  searchForPlayer: '搜索玩家',
  searchDbLoaded: '数据库已加载！输入玩家名称即可搜索。',
  searchDbDefault: '输入玩家名称搜索数据库，\n或直接输入账户ID查看。',
  searchDownloading: '正在下载玩家数据库...',
  searchDownloadingSub: '首次搜索可能需要10-30秒（数据库约66MB）。\n后续搜索将即时完成。',
  searchFirstTime: '正在后台下载约66MB数据库。\n下载完成后即可搜索。',
  searchResults: '个结果',

  hintKD: '击杀比',
  hintSurvival: '存活率',
  hintSkills: '技能',

  playerProfile: '玩家资料',
  xp: '经验值',
  accountId: '账户ID',
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

  loadout: '装备',
  noLoadout: '暂无装备数据',

  skills: '技能',

  notFoundTitle: '此页面不存在。',
  notFoundLink: '返回首页！',

  language: '语言',
  switchLang: '中文',

  slotPrimary: '主武器',
  slotSecondary: '副武器',
  slotSidearm: '手枪',
  slotArmor: '护甲',
  slotRig: '战术背心',
  slotFaceCover: '面罩',
  slotSecure: '安全箱',
  slotArmband: '臂章',
};

export const translations: Record<Language, Translations> = { en, zh };
