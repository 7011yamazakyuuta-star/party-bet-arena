import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Flag,
  Gamepad2,
  Home,
  LogIn,
  Lock,
  Medal,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import {
  calculateAutoOdds,
  clampCount,
  clampRaceCount,
  clampRating,
  createBet,
  currency,
  getAvailableBalance,
  getBetPickIds,
  getContestant,
  getEffectiveMultiplier,
  getPotentialPayout,
  isBetHit,
  rankedPlayers,
  requiredPickCount,
  settleRoom,
  startNextRace,
  validateBet,
} from "./lib/calculations";
import { createBlankRoom } from "./lib/sample";
import {
  deleteFirebaseRoom,
  fetchFirebaseRoom,
  getFirebaseIssueKind,
  getFirebaseUid,
  isFirebaseConfigured,
  joinFirebaseRoom,
  saveFirebaseBet,
  saveFirebasePlayer,
  saveFirebaseRoom,
  subscribeFirebaseRoom,
} from "./lib/firebase";
import {
  forgetRoomSummary,
  isRoomDeleted,
  loadRoom,
  loadRoomSummaries,
  loadSession,
  resetLocalRoom,
  restoreRoomSummary,
  saveRoom,
  saveSession,
} from "./lib/storage";
import type { LocalRoomSummary } from "./lib/storage";
import type { BetType, DraftBet, LanguageName, Player, RaceBetResult, Room, ThemeName, UiModeName } from "./lib/types";
import {
  RankBetView,
  RankBottomNav,
  RankHomeView,
  RankHostView,
  RankJoinPanel,
  RankLaunchView,
  RankRankingView,
  RankRoomHeader,
} from "./RankPartyViews";

type TabKey = "home" | "bet" | "host" | "ranking";
type Translate = (ja: string, en: string) => string;
type BetDisplayMode = "cards" | "board";
type ResultDisplayMode = "ranking" | "payouts";
type HostSection = "progress" | "settings" | "players" | "contestants";

const themeOrder: ThemeName[] = ["arena", "neon"];
const uiModeOrder: UiModeName[] = ["smart"];
const emojiChoices = [
  "😀",
  "😎",
  "🥳",
  "🎮",
  "🎲",
  "🎯",
  "🏆",
  "👑",
  "🔥",
  "⚡",
  "🌟",
  "⭐",
  "🍀",
  "🌈",
  "🍭",
  "🎤",
  "🎧",
  "🚗",
  "🏎️",
  "🚀",
  "🛡️",
  "💎",
  "🤖",
  "🍄",
];

function getThemeCopy(t: Translate): Record<ThemeName, { label: string; note: string }> {
  return {
    arena: { label: t("ライト", "Light"), note: t("白と黄色の標準デザイン", "White and yellow default") },
    party: { label: t("ライト補助", "Light alt"), note: t("白と黄色に合わせた補助テーマ", "Fallback light treatment") },
    garden: { label: t("ガーデン", "Garden"), note: t("緑と白の落ち着いた遊び場", "Soft green and calm") },
    candy: { label: t("キャンディ", "Candy"), note: t("少しポップでにぎやか", "Playful and colorful") },
    sky: { label: t("スカイ", "Sky"), note: t("青空っぽく見やすい", "Clear and airy") },
    neon: { label: t("ダーク", "Dark"), note: t("黒と黄色のプレミアム表示", "Black and yellow premium") },
    pop: { label: t("ポップ", "Pop"), note: t("濃いめのイベント感", "Vivid event mood") },
    minimal: { label: t("ミニマル", "Minimal"), note: t("控えめで読みやすい", "Quiet and readable") },
  };
}

function getUiModeCopy(t: Translate): Record<UiModeName, { label: string; note: string; tag: string }> {
  return {
    smart: {
      label: t("スマートUI", "Smart UI"),
      note: t("次にやることを先に出す、初見向けの整理表示", "Guided layout that surfaces the next action first"),
      tag: t("おすすめ", "Recommended"),
    },
  };
}

function getBetTypeCopy(t: Translate): Record<BetType, { title: string; note: string }> {
  return {
    win: { title: t("単勝", "Win"), note: t("1位を当てる", "Pick 1st place") },
    place: { title: t("複勝", "Place"), note: t("3位以内を当てる", "Pick top 3") },
    exacta: { title: t("2連単", "Exacta"), note: t("1位・2位を順番通り", "Pick 1st and 2nd in order") },
    trifecta: { title: t("3連単", "Trifecta"), note: t("1位から3位まで順番通り", "Pick 1st to 3rd in order") },
  };
}

const quickAmounts = [10, 50, 100, 500, 1000, 5000];
const levelChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const languageOptions: Array<{ value: LanguageName; label: string; short: string }> = [
  { value: "ja", label: "日本語", short: "JP" },
  { value: "en", label: "English", short: "EN" },
  { value: "zh", label: "中文", short: "ZH" },
  { value: "ko", label: "한국어", short: "KO" },
  { value: "es", label: "Español", short: "ES" },
  { value: "fr", label: "Français", short: "FR" },
  { value: "de", label: "Deutsch", short: "DE" },
  { value: "it", label: "Italiano", short: "IT" },
  { value: "uk", label: "Українська", short: "UA" },
];

const languageDictionary: Partial<Record<LanguageName, Record<string, string>>> = {
  zh: {
    Home: "首页",
    Bet: "下注",
    Host: "主持",
    Ranks: "排名",
    Room: "房间",
    Code: "代码",
    Mode: "模式",
    Available: "可用",
    Ranking: "排名",
    Payouts: "派彩",
    "Room list": "房间列表",
    Open: "打开",
    Delete: "删除",
  },
  ko: {
    Home: "홈",
    Bet: "베팅",
    Host: "진행",
    Ranks: "순위",
    Room: "방",
    Code: "코드",
    Mode: "모드",
    Available: "사용 가능",
    Ranking: "순위",
    Payouts: "정산",
    "Room list": "방 목록",
    Open: "열기",
    Delete: "삭제",
  },
  es: {
    Home: "Inicio",
    Bet: "Apostar",
    Host: "Anfitrión",
    Ranks: "Rangos",
    Room: "Sala",
    Code: "Código",
    Mode: "Modo",
    Available: "Disponible",
    Ranking: "Clasificación",
    Payouts: "Pagos",
    "Room list": "Salas",
    Open: "Abrir",
    Delete: "Eliminar",
  },
  fr: {
    Home: "Accueil",
    Bet: "Miser",
    Host: "Hôte",
    Ranks: "Classement",
    Room: "Salon",
    Code: "Code",
    Mode: "Mode",
    Available: "Disponible",
    Ranking: "Classement",
    Payouts: "Gains",
    "Room list": "Salons",
    Open: "Ouvrir",
    Delete: "Supprimer",
  },
  de: {
    Home: "Start",
    Bet: "Wette",
    Host: "Host",
    Ranks: "Rang",
    Room: "Raum",
    Code: "Code",
    Mode: "Modus",
    Available: "Verfügbar",
    Ranking: "Rangliste",
    Payouts: "Auszahlung",
    "Room list": "Räume",
    Open: "Öffnen",
    Delete: "Löschen",
  },
  it: {
    Home: "Home",
    Bet: "Punta",
    Host: "Host",
    Ranks: "Classifica",
    Room: "Stanza",
    Code: "Codice",
    Mode: "Modalità",
    Available: "Disponibile",
    Ranking: "Classifica",
    Payouts: "Vincite",
    "Room list": "Stanze",
    Open: "Apri",
    Delete: "Elimina",
  },
  uk: {
    Home: "Головна",
    Bet: "Ставка",
    Host: "Ведучий",
    Ranks: "Рейтинг",
    Room: "Кімната",
    Code: "Код",
    Mode: "Режим",
    Available: "Доступно",
    Ranking: "Рейтинг",
    Payouts: "Виплати",
    "Room list": "Кімнати",
    Open: "Відкрити",
    Delete: "Видалити",
  },
};

function translateText(language: LanguageName, ja: string, en: string) {
  if (language === "ja") return ja;
  if (language === "en") return en;
  return languageDictionary[language]?.[en] ?? en;
}

function translateBetError(error: string, t: Translate) {
  const messages: Record<string, string> = {
    "BET受付中ではありません。": "Betting is closed.",
    "プレイヤーを選んでください。": "Choose a bettor first.",
    "賭け先を選んでください。": "Choose who to bet on.",
    "同じ対象を複数順位に選ぶことはできません。": "You cannot choose the same player for multiple positions.",
    "BET額を入力してください。": "Enter a bet amount.",
    "利用可能コインを超えています。": "This bet exceeds available coins.",
  };
  const pickCountMatch = error.match(/^(\d+)つの順位を選んでください。$/);
  if (pickCountMatch) return t(error, `Choose ${pickCountMatch[1]} positions.`);
  return t(error, messages[error] ?? error);
}

function getFirebaseIssueCopy(error: unknown, t: Translate) {
  const kind = getFirebaseIssueKind(error);
  if (kind === "anonymous-auth") {
    return t(
      "Firebaseの匿名ログインが無効です。Firebase Console の Authentication > Sign-in method で「匿名」を有効にしてください。",
      "Anonymous sign-in is disabled. Enable Anonymous in Firebase Console > Authentication > Sign-in method.",
    );
  }
  if (kind === "permission") {
    return t(
      "Firebaseの保存権限が拒否されました。Realtime Database のルールを公開したか、匿名ログインが有効か確認してください。",
      "Firebase denied the save. Check Realtime Database rules and Anonymous sign-in.",
    );
  }
  if (kind === "database-url") {
    return t(
      "Firebase Database URL が違う可能性があります。GitHub Actions Variables の VITE_FIREBASE_DATABASE_URL を Realtime Database のURLにしてください。",
      "The Firebase Database URL may be wrong. Set VITE_FIREBASE_DATABASE_URL to the Realtime Database URL.",
    );
  }
  if (kind === "network") {
    return t(
      "通信に失敗しました。電波状況、広告ブロック、またはFirebase側の一時的な接続を確認してください。",
      "Network sync failed. Check connection, blockers, or Firebase availability.",
    );
  }
  return t(
    "Firebase保存に失敗しました。端末内の状態は残っています。DB作成、URL、ルール、匿名ログインを確認してください。",
    "Firebase save failed. Local state is kept. Check database, URL, rules, and Anonymous sign-in.",
  );
}

function App() {
  const [room, setRoom] = useState(loadRoom);
  const [roomSummaries, setRoomSummaries] = useState(loadRoomSummaries);
  const [session, setSession] = useState(loadSession);
  const [showLauncher, setShowLauncher] = useState(true);
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedContestantId, setSelectedContestantId] = useState(room.contestants[0]?.id ?? "");
  const [selectedPickIds, setSelectedPickIds] = useState<string[]>(room.contestants[0]?.id ? [room.contestants[0].id] : []);
  const [betType, setBetType] = useState<BetType>("win");
  const [amount, setAmount] = useState(100);
  const [betDisplayMode, setBetDisplayMode] = useState<BetDisplayMode>("board");
  const [resultDisplayMode, setResultDisplayMode] = useState<ResultDisplayMode>("ranking");
  const [proxyPlayerId, setProxyPlayerId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState(room.isDemo ? "" : room.id);
  const [joinCode, setJoinCode] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerOffline, setNewPlayerOffline] = useState(true);
  const [newPlayerEmoji, setNewPlayerEmoji] = useState("🎮");
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantOdds, setNewContestantOdds] = useState(2.5);
  const [newContestantCpuLevel, setNewContestantCpuLevel] = useState(7);
  const [newContestantIsCpu, setNewContestantIsCpu] = useState(true);
  const [newContestantEmoji, setNewContestantEmoji] = useState("🤖");
  const [bonusPlayerId, setBonusPlayerId] = useState(room.players[0]?.id ?? "");
  const [bonusAmount, setBonusAmount] = useState(room.settings.specialBonus);
  const [resultIds, setResultIds] = useState<string[]>(room.currentRace.resultIds);
  const [toast, setToast] = useState("");
  const [syncIssue, setSyncIssue] = useState("");
  const language = session.language ?? "ja";
  const t: Translate = (ja, en) => translateText(language, ja, en);
  const betTypeLabels = useMemo(() => getBetTypeCopy(t), [language]);
  const themeCopy = useMemo(() => getThemeCopy(t), [language]);
  const uiModeCopy = useMemo(() => getUiModeCopy(t), [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = room.theme;
  }, [room.theme]);

  useEffect(() => {
    document.documentElement.dataset.uiMode = room.uiMode;
  }, [room.uiMode]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    setResultIds(room.currentRace.resultIds);
  }, [room.currentRace.id, room.currentRace.resultIds]);

  useEffect(() => {
    setSelectedPickIds((current) => current.slice(0, requiredPickCount(betType)));
  }, [betType]);

  useEffect(() => {
    if (session.role !== "host" || !proxyPlayerId) return;
    if (!room.players.some((player) => player.id === proxyPlayerId)) {
      setProxyPlayerId("");
    }
  }, [proxyPlayerId, room.players, session.role]);

  useEffect(() => {
    const frame = document.querySelector<HTMLElement>(".phone-frame");
    window.scrollTo({ top: 0, behavior: "auto" });
    frame?.scrollTo({ top: 0, behavior: "auto" });
  }, [showLauncher, tab, room.id, room.currentRace.id]);

  useEffect(() => {
    if (!room.players.length) return;
    if (!room.players.some((player) => player.id === bonusPlayerId)) {
      setBonusPlayerId(room.players[0].id);
    }
  }, [bonusPlayerId, room.players]);

  useEffect(() => {
    if (!isFirebaseConfigured || room.isDemo) return;

    let unsubscribe: undefined | (() => void);
    subscribeFirebaseRoom(room.id, (remoteRoom) => {
      if (isRoomDeleted(remoteRoom.id)) return;
      setRoom(remoteRoom);
      setRoomSummaries(saveRoom(remoteRoom));
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, [room.id, room.isDemo]);

  const ranking = useMemo(() => rankedPlayers(room.players), [room.players]);
  const currentPlayer = room.players.find((player) => player.id === session.playerId);
  const activePlayerId = session.role === "host" ? proxyPlayerId : currentPlayer?.id ?? "";
  const activePlayer = room.players.find((player) => player.id === activePlayerId);
  const selectedContestant = getContestant(room, selectedContestantId);
  const draftContestants = selectedPickIds
    .map((contestantId) => getContestant(room, contestantId))
    .filter((contestant): contestant is NonNullable<ReturnType<typeof getContestant>> => Boolean(contestant));
  const draftMultiplier =
    draftContestants.length === requiredPickCount(betType)
      ? getEffectiveMultiplier(room, betType, draftContestants)
      : 0;
  const draftBet: DraftBet = {
    playerId: activePlayerId,
    contestantId: selectedContestantId,
    contestantIds: selectedPickIds,
    type: betType,
    amount,
    multiplier: draftMultiplier,
    placedBy: session.role === "host" ? "host" : "self",
  };
  const potentialPayout = getPotentialPayout(room, draftBet);
  const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
  const placedPlayerCount = new Set(room.currentRace.bets.map((bet) => bet.playerId)).size;
  const allPlayersPlaced = room.players.length > 0 && placedPlayerCount >= room.players.length;
  const isLaunchScreen = showLauncher;
  const publicUrl = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
  const hasJackpot = room.currentRace.status === "settled" && room.currentRace.bets.some((bet) => {
    const contestant = getContestant(room, getBetPickIds(bet)[0]);
    return contestant && contestant.odds >= 4 && isBetHit(bet.type, getBetPickIds(bet), room.currentRace.resultIds);
  });

  useEffect(() => {
    if (session.role !== "player" || !currentPlayer) return;
    const nextTab: TabKey = room.currentRace.status === "settled" ? "ranking" : "bet";
    if (tab !== nextTab) setTab(nextTab);
  }, [currentPlayer?.id, room.currentRace.id, room.currentRace.status, session.role, tab]);

  function commitRoom(nextRoom: Room, sync = true) {
    setRoom(nextRoom);
    setRoomSummaries(saveRoom(nextRoom));
    if (sync && isFirebaseConfigured && !nextRoom.isDemo) {
      saveFirebaseRoom(nextRoom).then(() => {
        setSyncIssue("");
      }).catch((error) => {
        const message = getFirebaseIssueCopy(error, t);
        setSyncIssue(message);
        setToast(message);
      });
    }
  }

  function updateRoom(updater: (current: Room) => Room) {
    commitRoom(updater(room));
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function handleCreateRoom() {
    let hostUid: string | undefined;
    if (isFirebaseConfigured) {
      try {
        hostUid = await getFirebaseUid();
      } catch (error) {
        const message = getFirebaseIssueCopy(error, t);
        setSyncIssue(message);
        showToast(message);
        return;
      }
    }
    const next = createBlankRoom(t("新しい勝負", "New Match"), hostUid);
    commitRoom(next);
    setSession((current) => ({ ...current, role: "host", playerId: undefined }));
    setShowLauncher(false);
    setTab("host");
    setProxyPlayerId("");
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    setJoinRoomId(next.id);
    showToast(t("本番ルームを作成しました。共有カードから招待できます。", "Live room created. Share it from the invite card."));
  }

  function handleHostMode() {
    setSession((current) => ({ ...current, role: "host", playerId: undefined }));
    setTab("host");
  }

  function handleJoinMode() {
    setSession((current) => ({ ...current, role: "player", playerId: undefined }));
    setJoinRoomId(room.isDemo ? "" : room.id);
    setJoinCode(room.isDemo ? "" : room.joinCode);
    setTab("home");
  }

  async function handleJoinPlayer() {
    const normalizedRoomId = joinRoomId.trim().toUpperCase();
    if (!normalizedRoomId || !joinCode.trim()) {
      showToast(t("ルームIDと参加コードを入力してください。", "Enter the room ID and join code."));
      return;
    }
    let targetRoom = room;
    let firebaseUid: string | undefined;

    if (isFirebaseConfigured && normalizedRoomId !== "DEMO42") {
      try {
        firebaseUid = await getFirebaseUid();
        await joinFirebaseRoom(normalizedRoomId, joinCode.trim());
        const remoteRoom = await fetchFirebaseRoom(normalizedRoomId);
        if (!remoteRoom) {
          showToast(t("ルームが見つかりません。ルームIDを確認してください。", "Room not found. Please check the room ID."));
          return;
        }
        targetRoom = remoteRoom;
      } catch (error) {
        const message = getFirebaseIssueKind(error) === "permission"
          ? t("ルームIDまたは参加コードが違います。", "Room ID or join code is incorrect.")
          : getFirebaseIssueCopy(error, t);
        setSyncIssue(message);
        showToast(message);
        return;
      }
    } else if (normalizedRoomId !== room.id) {
      showToast(t("公開ルームへの参加にはFirebase設定が必要です。", "Firebase setup is required to join a shared room."));
      return;
    }

    if (normalizedRoomId !== targetRoom.id || joinCode.trim() !== targetRoom.joinCode) {
      showToast(t("ルームIDまたは参加コードが違います。", "Room ID or join code is incorrect."));
      return;
    }

    const name = joinName.trim() || t(`参加者 ${targetRoom.players.length + 1}`, `Player ${targetRoom.players.length + 1}`);
    if (targetRoom.players.length >= targetRoom.settings.maxPlayers) {
      showToast(t(`参加者は最大${targetRoom.settings.maxPlayers}人までです。`, `Up to ${targetRoom.settings.maxPlayers} bettors can join.`));
      return;
    }

    const player: Player = {
      id: crypto.randomUUID(),
      uid: firebaseUid,
      name,
      balance: targetRoom.startingBalance,
      isOffline: false,
      accent: ["#ff4c69", "#3568ff", "#f2c114", "#25bf45"][targetRoom.players.length % 4],
      emoji: emojiChoices[targetRoom.players.length % emojiChoices.length],
    };

    const next = {
      ...targetRoom,
      players: [...targetRoom.players, player],
      updatedAt: Date.now(),
    };
    restoreRoomSummary(next.id);
    commitRoom(next, false);
    if (isFirebaseConfigured && !next.isDemo) {
      try {
        await saveFirebasePlayer(next.id, player);
        setSyncIssue("");
      } catch (error) {
        const message = getFirebaseIssueCopy(error, t);
        setSyncIssue(message);
        showToast(message);
        return;
      }
    }
    setSession((current) => ({ ...current, role: "player", playerId: player.id }));
    setShowLauncher(false);
    setTab("bet");
    showToast(t(`${name}で参加しました。`, `Joined as ${name}.`));
  }

  async function handleOpenRoom(roomId: string) {
    if (room.id === roomId) {
      setShowLauncher(false);
      setTab("home");
      showToast(t("このルームを表示中です。", "This room is already open."));
      return;
    }
    if (!isFirebaseConfigured) {
      showToast(t("過去ルームを開くにはFirebase設定が必要です。", "Firebase setup is required to reopen past rooms."));
      return;
    }

    try {
      const remoteRoom = await fetchFirebaseRoom(roomId);
      if (!remoteRoom) {
        showToast(t("ルームが見つかりません。削除済みか、Firebase設定を確認してください。", "Room not found. It may be deleted or Firebase may need setup."));
        return;
      }
      restoreRoomSummary(remoteRoom.id);
      commitRoom(remoteRoom, false);
      setSession((current) => ({ ...current, role: "host", playerId: undefined }));
      setProxyPlayerId("");
      setBonusPlayerId(remoteRoom.players[0]?.id ?? "");
      setSelectedContestantId(remoteRoom.contestants[0]?.id ?? "");
      setSelectedPickIds(remoteRoom.contestants[0]?.id ? [remoteRoom.contestants[0].id] : []);
      setResultIds(remoteRoom.currentRace.resultIds ?? []);
      setShowLauncher(false);
      setTab("home");
      showToast(t("ルームを開きました。", "Room opened."));
    } catch (error) {
      const message = getFirebaseIssueCopy(error, t);
      setSyncIssue(message);
      showToast(message);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    const target = roomSummaries.find((item) => item.id === roomId);
    const confirmed = window.confirm(
      isFirebaseConfigured
        ? t(
          `${target?.name ?? roomId}を一覧から削除しますか？Firebase上のルーム削除も試します。`,
          `Delete ${target?.name ?? roomId} from the list and try to delete it from Firebase?`,
        )
        : t(
          `${target?.name ?? roomId}をこの端末の一覧から削除しますか？`,
          `Delete ${target?.name ?? roomId} from this device's list?`,
        ),
    );
    if (!confirmed) return;

    let remoteDeleteFailed = false;
    if (isFirebaseConfigured) {
      try {
        await deleteFirebaseRoom(roomId);
      } catch (error) {
        remoteDeleteFailed = true;
      }
    }

    setRoomSummaries(forgetRoomSummary(roomId));
    if (room.id === roomId) {
      const next = resetLocalRoom();
      setRoom(next);
      setSession((current) => ({ ...current, role: "host", playerId: undefined }));
      setProxyPlayerId("");
      setBonusPlayerId(next.players[0]?.id ?? "");
      setSelectedContestantId(next.contestants[0]?.id ?? "");
      setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
      setResultIds(next.currentRace.resultIds);
      setTab("home");
    }

    showToast(
      remoteDeleteFailed
        ? t("この端末の一覧から削除しました。Firebase側はルールを確認してください。", "Removed from this device. Check Firebase rules for remote deletion.")
        : t("ルームを削除しました。", "Room deleted."),
    );
  }

  function handleRoomNameChange(name: string) {
    updateRoom((current) => ({ ...current, name, updatedAt: Date.now() }));
  }

  async function handleCopyInvite() {
    const text = `ランクパーティ\nURL: ${publicUrl}\n${t("ルームID", "Room ID")}: ${room.id}\n${t("参加コード", "Join code")}: ${room.joinCode}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("招待情報をコピーしました。", "Invite copied."));
    } catch {
      showToast(t("コピーできませんでした。URLとルームIDを手動で共有してください。", "Could not copy. Please share the URL and room ID manually."));
    }
  }

  async function handlePlaceBet() {
    const error = validateBet(room, draftBet);
    if (error) {
      showToast(translateBetError(error, t));
      return;
    }
    let firebaseUid: string | undefined;
    if (isFirebaseConfigured && !room.isDemo) {
      try {
        firebaseUid = await getFirebaseUid();
      } catch (firebaseError) {
        const message = getFirebaseIssueCopy(firebaseError, t);
        setSyncIssue(message);
        showToast(message);
        return;
      }
    }
    const bet = createBet({ ...draftBet, uid: firebaseUid });

    const next = {
      ...room,
      currentRace: {
        ...room.currentRace,
        bets: [...room.currentRace.bets, bet],
      },
      updatedAt: Date.now(),
    };

    if (isFirebaseConfigured && !room.isDemo) {
      commitRoom(next, false);
      try {
        await saveFirebaseBet(room.id, bet);
        setSyncIssue("");
      } catch (firebaseError) {
        const message = getFirebaseIssueCopy(firebaseError, t);
        setSyncIssue(message);
        showToast(message);
        return;
      }
    } else {
      commitRoom(next);
    }
    showToast(t("ベットを受け付けました。", "Bet placed."));
  }

  function handleAddPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    if (room.players.length >= room.settings.maxPlayers) {
      showToast(t(`参加者は最大${room.settings.maxPlayers}人までです。`, `Up to ${room.settings.maxPlayers} bettors can join.`));
      return;
    }
    const playerId = crypto.randomUUID();

    updateRoom((current) => ({
      ...current,
      players: [
        ...current.players,
        {
          id: playerId,
          name,
          balance: current.startingBalance,
          isOffline: newPlayerOffline,
          accent: ["#55f3ec", "#9d7cff", "#ffcf5b", "#ff8f70"][current.players.length % 4],
          emoji: newPlayerEmoji,
        },
      ],
      updatedAt: Date.now(),
    }));
    setNewPlayerName("");
    setNewPlayerEmoji(emojiChoices[(room.players.length + 1) % emojiChoices.length]);
    setProxyPlayerId(playerId);
    showToast(t("参加者を追加しました。", "Bettor added."));
  }

  function handleDeletePlayer(playerId: string) {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return;
    const confirmed = window.confirm(
      t(
        `${player.name}を参加者から削除しますか？この勝負で入っているベットも外れます。`,
        `Remove ${player.name} from bettors? Their bets in this round will be removed too.`,
      ),
    );
    if (!confirmed) return;

    const fallbackPlayerId = room.players.find((item) => item.id !== playerId)?.id ?? "";
    updateRoom((current) => ({
      ...current,
      players: current.players.filter((item) => item.id !== playerId),
      currentRace: {
        ...current.currentRace,
        bets: current.currentRace.bets.filter((bet) => bet.playerId !== playerId),
      },
      raceHistory: current.raceHistory.map((entry) => ({
        ...entry,
        payouts: entry.payouts.filter((payout) => payout.playerId !== playerId),
      })),
      updatedAt: Date.now(),
    }));
    if (proxyPlayerId === playerId) setProxyPlayerId(fallbackPlayerId);
    if (bonusPlayerId === playerId) setBonusPlayerId(fallbackPlayerId);
    if (session.playerId === playerId) {
      setSession((current) => ({ ...current, playerId: undefined }));
    }
    showToast(t(`${player.name}を削除しました。`, `${player.name} removed.`));
  }

  function handleAddContestant() {
    if (room.contestants.length >= room.settings.maxContestants) {
      showToast(t(`勝負するプレイヤーは最大${room.settings.maxContestants}人までです。`, `Up to ${room.settings.maxContestants} contestants can play.`));
      return;
    }
    const name = newContestantName.trim() || (newContestantIsCpu ? `CPU${room.contestants.length + 1}` : `Player ${room.contestants.length + 1}`);

    updateRoom((current) => ({
      ...current,
      contestants: current.settings.autoOdds
        ? calculateAutoOdds([
            ...current.contestants,
            {
              id: crypto.randomUUID(),
              name,
              odds: Math.max(1.01, newContestantOdds),
              accent: ["#ff4c69", "#3568ff", "#f2c114", "#25bf45"][current.contestants.length % 4],
              icon: newContestantEmoji,
              strengthRating: clampRating(newContestantCpuLevel),
              cpuLevel: clampRating(newContestantCpuLevel),
              isCpu: newContestantIsCpu,
            },
          ])
        : [
            ...current.contestants,
            {
              id: crypto.randomUUID(),
              name,
              odds: Math.max(1.01, newContestantOdds),
              accent: ["#ff4c69", "#3568ff", "#f2c114", "#25bf45"][current.contestants.length % 4],
              icon: newContestantEmoji,
              strengthRating: clampRating(newContestantCpuLevel),
              cpuLevel: clampRating(newContestantCpuLevel),
              isCpu: newContestantIsCpu,
            },
          ],
      updatedAt: Date.now(),
    }));
    setNewContestantName("");
    setNewContestantOdds(2.5);
    setNewContestantCpuLevel(7);
    setNewContestantEmoji(emojiChoices[(room.contestants.length + 3) % emojiChoices.length]);
    showToast(t("勝負するプレイヤーを追加しました。", "Contestant added."));
  }

  function handleDeleteContestant(contestantId: string) {
    const contestant = room.contestants.find((item) => item.id === contestantId);
    if (!contestant || room.contestants.length <= 1) {
      showToast(t("対戦者は1人以上必要です。", "At least one contestant is required."));
      return;
    }
    const confirmed = window.confirm(
      t(
        `${contestant.name}を対戦者から削除しますか？このレースの関連ベットも削除されます。`,
        `Remove ${contestant.name}? Related bets in this race will also be removed.`,
      ),
    );
    if (!confirmed) return;

    updateRoom((current) => {
      const contestants = current.contestants.filter((item) => item.id !== contestantId);
      return {
        ...current,
        contestants: current.settings.autoOdds ? calculateAutoOdds(contestants) : contestants,
        currentRace: {
          ...current.currentRace,
          bets: current.currentRace.bets.filter((bet) => !getBetPickIds(bet).includes(contestantId)),
          resultIds: current.currentRace.resultIds.filter((id) => id !== contestantId),
        },
        updatedAt: Date.now(),
      };
    });
    setSelectedPickIds((current) => current.filter((id) => id !== contestantId));
    if (selectedContestantId === contestantId) {
      setSelectedContestantId(room.contestants.find((item) => item.id !== contestantId)?.id ?? "");
    }
    showToast(t(`${contestant.name}を削除しました。`, `${contestant.name} removed.`));
  }

  function handleOddsChange(contestantId: string, odds: number) {
    updateRoom((current) => ({
      ...current,
      settings: { ...current.settings, autoOdds: false },
      contestants: current.contestants.map((contestant) =>
        contestant.id === contestantId ? { ...contestant, odds: Math.max(1.01, odds) } : contestant,
      ),
      updatedAt: Date.now(),
    }));
  }

  function handleThemeChange(theme: ThemeName) {
    updateRoom((current) => ({ ...current, theme, updatedAt: Date.now() }));
  }

  function handleUiModeChange(uiMode: UiModeName) {
    updateRoom((current) => ({ ...current, uiMode, updatedAt: Date.now() }));
  }

  function handleLanguageChange(nextLanguage: LanguageName) {
    setSession((current) => ({ ...current, language: nextLanguage }));
  }

  function handleStartingBalanceChange(value: number) {
    const nextValue = Math.floor(Number.isFinite(value) ? value : room.startingBalance);
    updateRoom((current) => ({ ...current, startingBalance: nextValue, updatedAt: Date.now() }));
  }

  function handlePickContestant(contestantId: string) {
    const count = requiredPickCount(betType);
    setSelectedPickIds((current) => {
      if (count === 1) {
        setSelectedContestantId(contestantId);
        return [contestantId];
      }

      const next = current.includes(contestantId)
        ? current.filter((id) => id !== contestantId)
        : [...current, contestantId].slice(-count);
      setSelectedContestantId(next[0] ?? contestantId);
      return next;
    });
  }

  function handlePickOrder(contestantIds: string[]) {
    const next = contestantIds.slice(0, requiredPickCount(betType));
    setSelectedPickIds(next);
    setSelectedContestantId(next[0] ?? "");
  }

  function handleContestantLevelChange(
    contestantId: string,
    patch: Partial<{ cpuLevel: number; isCpu: boolean; icon: string }>,
  ) {
    updateRoom((current) => {
      const contestants = current.contestants.map((contestant) =>
        contestant.id === contestantId
          ? (() => {
              const nextCpuLevel = clampRating(patch.cpuLevel ?? contestant.cpuLevel);
              return {
                ...contestant,
                ...patch,
                cpuLevel: nextCpuLevel,
                strengthRating: nextCpuLevel,
              };
            })()
          : contestant,
      );

      const shouldRecalculateOdds = "cpuLevel" in patch || "isCpu" in patch;

      return {
        ...current,
        settings: shouldRecalculateOdds ? { ...current.settings, autoOdds: true } : current.settings,
        contestants: shouldRecalculateOdds || current.settings.autoOdds ? calculateAutoOdds(contestants) : contestants,
        updatedAt: Date.now(),
      };
    });
  }

  function handlePlayerEmojiChange(playerId: string, emoji: string) {
    updateRoom((current) => ({
      ...current,
      players: current.players.map((player) => (player.id === playerId ? { ...player, emoji } : player)),
      updatedAt: Date.now(),
    }));
  }

  function handleSettingChange(
    key: "maxPlayers" | "maxContestants" | "autoOdds" | "marketOdds" | "allowDebt" | "maxRaces" | "specialBonus",
    value: number | boolean,
  ) {
    updateRoom((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]:
          typeof value === "number"
            ? key === "maxRaces"
              ? clampRaceCount(value)
              : key === "specialBonus"
                ? Math.max(0, Math.floor(value))
                : clampCount(value)
            : value,
      },
      updatedAt: Date.now(),
    }));
    if (key === "specialBonus" && typeof value === "number") {
      setBonusAmount(Math.max(0, Math.floor(value)));
    }
  }

  function handleGrantBonus() {
    const amountToGrant = Math.floor(bonusAmount);
    if (!bonusPlayerId || amountToGrant <= 0) {
      showToast(t("ボーナス対象と金額を確認してください。", "Choose a bonus player and amount."));
      return;
    }

    updateRoom((current) => ({
      ...current,
      players: current.players.map((player) =>
        player.id === bonusPlayerId ? { ...player, balance: player.balance + amountToGrant } : player,
      ),
      settings: { ...current.settings, specialBonus: amountToGrant },
      updatedAt: Date.now(),
    }));
    showToast(t("特別ボーナスを付与しました。", "Special bonus granted."));
  }

  function handleAutoOdds() {
    updateRoom((current) => ({
      ...current,
      settings: { ...current.settings, autoOdds: true },
      contestants: calculateAutoOdds(current.contestants),
      updatedAt: Date.now(),
    }));
    showToast(t("強さ/CPU Lvからオッズを自動調整しました。", "Odds updated from strength and CPU level."));
  }

  function handleResultPick(contestantId: string) {
    setResultIds((current) => {
      if (current.includes(contestantId)) return current.filter((id) => id !== contestantId);
      return [...current, contestantId];
    });
  }

  function handleSettle() {
    if (resultIds.length !== room.contestants.length) {
      showToast(t("1位から最下位まで順番に選んでください。", "Pick every result from first to last."));
      return;
    }
    commitRoom(settleRoom(room, resultIds));
    showToast(t("この勝負の払戻を反映しました。次の勝負へ進めます。", "Payouts applied for this round. You can start the next round."));
  }

  function handleNextRace() {
    const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
    if (room.currentRace.status !== "settled") {
      showToast(t("先に順位を入力して、払戻を反映してください。", "Enter results and apply payouts first."));
      setTab("host");
      return;
    }
    if (currentRaceNumber >= room.settings.maxRaces) {
      showToast(t("最終レースまで完了しました。ランキングで結果を確認してください。", "The final race is complete. Check the ranking."));
      setTab("ranking");
      return;
    }
    const next = startNextRace(room);
    commitRoom(next);
    setResultIds([]);
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    setTab("bet");
    showToast(t("次の勝負を開始しました。", "Next round started."));
  }

  function handleResetDemo() {
    const next = resetLocalRoom();
    setRoom(next);
    setSession((current) => ({ ...current, role: "host", playerId: undefined }));
    setShowLauncher(true);
    setTab("home");
    setJoinRoomId("");
    setJoinCode("");
    setProxyPlayerId("");
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    showToast(t("デモ状態をリセットしました。", "Demo reset."));
  }

  return (
    <main className="app-shell">
      <section className={isLaunchScreen ? "phone-frame launch-frame" : `phone-frame app-view app-view-${tab}`} aria-label="ランクパーティ">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />

        {isLaunchScreen ? (
          <>
            <RankLaunchView
              joinName={joinName}
              setJoinName={setJoinName}
              joinRoomId={joinRoomId}
              setJoinRoomId={setJoinRoomId}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              language={language}
              onLanguageChange={handleLanguageChange}
              roomSummaries={roomSummaries}
              firebaseReady={isFirebaseConfigured}
              t={t}
              onCreateRoom={handleCreateRoom}
              onJoin={handleJoinPlayer}
              onOpenRoom={handleOpenRoom}
              onDeleteRoom={handleDeleteRoom}
            />

            {toast && (
              <div className="toast" role="status">
                {toast}
              </div>
            )}
          </>
        ) : (
          <>
        {!(session.role === "player" && !currentPlayer) && (
          <RankRoomHeader
            tab={tab}
            room={room}
            sessionRole={session.role}
            activePlayer={activePlayer}
            currentRaceNumber={currentRaceNumber}
            t={t}
            onBack={() => setShowLauncher(true)}
            onHostMode={handleHostMode}
            onJoinMode={handleJoinMode}
          />
        )}

        {syncIssue && !room.isDemo && (
          <section className="sync-alert" role="status">
            <Radio size={18} />
            <p>{syncIssue}</p>
            <button className="tertiary-button compact-button" type="button" onClick={() => setSyncIssue("")}>
              {t("閉じる", "Close")}
            </button>
          </section>
        )}

        {session.role === "player" && !currentPlayer ? (
          <RankJoinPanel
            joinName={joinName}
            setJoinName={setJoinName}
            joinRoomId={joinRoomId}
            setJoinRoomId={setJoinRoomId}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onJoin={handleJoinPlayer}
            t={t}
          />
        ) : (
          <>
            {tab === "home" && (
              <RankHomeView
                room={room}
                ranking={ranking}
                currentRaceNumber={currentRaceNumber}
                hasJackpot={hasJackpot}
                publicUrl={publicUrl}
                roomSummaries={roomSummaries}
                t={t}
                onCreateRoom={handleCreateRoom}
                onBetTab={() => setTab("bet")}
                onHostTab={handleHostMode}
                onJoinMode={handleJoinMode}
                onResetDemo={handleResetDemo}
                onCopyInvite={handleCopyInvite}
                onOpenRoom={handleOpenRoom}
                onDeleteRoom={handleDeleteRoom}
              />
            )}

            {tab === "bet" && (
              <RankBetView
                room={room}
                sessionRole={session.role}
                activePlayer={activePlayer}
                proxyPlayerId={proxyPlayerId}
                setProxyPlayerId={setProxyPlayerId}
                selectedContestantId={selectedContestantId}
                setSelectedContestantId={setSelectedContestantId}
                selectedPickIds={selectedPickIds}
                onPickContestant={handlePickContestant}
                betType={betType}
                setBetType={setBetType}
                amount={amount}
                setAmount={setAmount}
                selectedContestant={selectedContestant}
                potentialPayout={potentialPayout}
                displayMode={betDisplayMode}
                setDisplayMode={setBetDisplayMode}
                currentRaceNumber={currentRaceNumber}
                placedPlayerCount={placedPlayerCount}
                allPlayersPlaced={allPlayersPlaced}
                onPickOrder={handlePickOrder}
                onPlaceBet={handlePlaceBet}
                betTypeLabels={betTypeLabels}
                t={t}
              />
            )}

            {tab === "host" && (
              <RankHostView
                room={room}
                newPlayerName={newPlayerName}
                setNewPlayerName={setNewPlayerName}
                newPlayerOffline={newPlayerOffline}
                setNewPlayerOffline={setNewPlayerOffline}
                newPlayerEmoji={newPlayerEmoji}
                setNewPlayerEmoji={setNewPlayerEmoji}
                newContestantName={newContestantName}
                setNewContestantName={setNewContestantName}
                newContestantOdds={newContestantOdds}
                setNewContestantOdds={setNewContestantOdds}
                newContestantCpuLevel={newContestantCpuLevel}
                setNewContestantCpuLevel={setNewContestantCpuLevel}
                newContestantIsCpu={newContestantIsCpu}
                setNewContestantIsCpu={setNewContestantIsCpu}
                newContestantEmoji={newContestantEmoji}
                setNewContestantEmoji={setNewContestantEmoji}
                bonusPlayerId={bonusPlayerId}
                setBonusPlayerId={setBonusPlayerId}
                bonusAmount={bonusAmount}
                setBonusAmount={setBonusAmount}
                resultIds={resultIds}
                themeCopy={themeCopy}
                uiModeCopy={uiModeCopy}
                betTypeLabels={betTypeLabels}
                currentRaceNumber={currentRaceNumber}
                placedPlayerCount={placedPlayerCount}
                allPlayersPlaced={allPlayersPlaced}
                t={t}
                onAddPlayer={handleAddPlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddContestant={handleAddContestant}
                onDeleteContestant={handleDeleteContestant}
                onOddsChange={handleOddsChange}
                onThemeChange={handleThemeChange}
                onUiModeChange={handleUiModeChange}
                onRoomNameChange={handleRoomNameChange}
                onStartingBalanceChange={handleStartingBalanceChange}
                onPlayerEmojiChange={handlePlayerEmojiChange}
                onContestantLevelChange={handleContestantLevelChange}
                onSettingChange={handleSettingChange}
                onAutoOdds={handleAutoOdds}
                onGrantBonus={handleGrantBonus}
                onResultPick={handleResultPick}
                onSettle={handleSettle}
                onNextRace={handleNextRace}
              />
            )}

            {tab === "ranking" && (
              <RankRankingView
                room={room}
                ranking={ranking}
                displayMode={resultDisplayMode}
                setDisplayMode={setResultDisplayMode}
                betTypeLabels={betTypeLabels}
                onNextRace={handleNextRace}
                t={t}
              />
            )}
          </>
        )}

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        {!(tab === "ranking" && resultDisplayMode === "payouts") && (
          <RankBottomNav active={tab} role={session.role} onChange={setTab} t={t} />
        )}
          </>
        )}
      </section>
    </main>
  );
}

function RoomHeader(props: {
  tab: TabKey;
  room: Room;
  sessionRole: "host" | "player";
  activePlayer?: Player;
  currentRaceNumber: number;
  t: Translate;
  onBack: () => void;
  onHostMode: () => void;
  onJoinMode: () => void;
}) {
  const balance = props.activePlayer ? currency.format(props.activePlayer.balance) : currency.format(props.room.players[0]?.balance ?? props.room.startingBalance);
  const isHostRoom = props.tab === "home" || props.tab === "host";
  const isBet = props.tab === "bet";
  const isRanking = props.tab === "ranking";

  return (
    <header className={`room-header room-header-${props.tab}`}>
      {isHostRoom ? (
        <>
          <div className="room-brand">
            <span className="brand-mark">
              <Crown size={26} />
            </span>
            <div>
              <h1>{props.t("ホストルーム", "Host Room")}</h1>
              <p>{props.room.name || props.t("ルーム", "Room")}</p>
            </div>
          </div>
          <span className="status-pill" role="status">
            <span />
            {props.t("進行中", "Live")}
          </span>
        </>
      ) : (
        <>
          <button className="back-button" type="button" onClick={props.onBack} aria-label={props.t("戻る", "Back")}>
            <ArrowLeft size={24} />
          </button>
          <div className="screen-title">
            <span className="screen-icon">
              {isBet ? <span className="emoji-screen-icon" aria-hidden="true">🐎</span> : <Crown size={23} />}
            </span>
            <h1>{isBet ? props.t("ベット", "Bet") : props.t("ランクパーティ", "Rank Party")}</h1>
          </div>
          <div className="header-balance" aria-label={props.t("残高", "Balance")}>
            <span>{props.t("残高", "Balance")}</span>
            <strong>{balance}</strong>
            {isRanking ? <Bell size={22} /> : <button type="button" onClick={props.sessionRole === "host" ? props.onHostMode : props.onJoinMode}>+</button>}
          </div>
        </>
      )}
      {isHostRoom && (
        <div className="room-header-progress" aria-label={props.t("現在のレース", "Current race")}>
          <span>{props.t("現在のレース", "Current race")}</span>
          <strong>
            {props.t("第", "Race ")}
            <b>{props.currentRaceNumber}</b>
            /{props.room.settings.maxRaces}
            {props.t(" レース", "")}
          </strong>
        </div>
      )}
    </header>
  );
}

function LaunchView(props: {
  joinName: string;
  setJoinName: (value: string) => void;
  joinRoomId: string;
  setJoinRoomId: (value: string) => void;
  joinCode: string;
  setJoinCode: (value: string) => void;
  language: LanguageName;
  onLanguageChange: (value: LanguageName) => void;
  roomSummaries: LocalRoomSummary[];
  firebaseReady: boolean;
  t: Translate;
  onCreateRoom: () => void;
  onJoin: () => void;
  onOpenRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const canJoin = props.joinRoomId.trim().length > 0 && props.joinCode.trim().length > 0;
  const [isJoinPage, setIsJoinPage] = useState(false);

  if (isJoinPage) {
    return (
      <JoinEntryScreen
        joinName={props.joinName}
        setJoinName={props.setJoinName}
        joinRoomId={props.joinRoomId}
        setJoinRoomId={props.setJoinRoomId}
        joinCode={props.joinCode}
        setJoinCode={props.setJoinCode}
        language={props.language}
        onLanguageChange={props.onLanguageChange}
        roomSummaries={props.roomSummaries}
        canJoin={canJoin}
        t={props.t}
        onBack={() => setIsJoinPage(false)}
        onJoin={props.onJoin}
        onOpenRoom={props.onOpenRoom}
      />
    );
  }

  return (
    <div className="launch-screen">
      <header className="launch-header">
        <div>
          <h1>{props.t("さあ、\n始めよう。", "Let's get started.")}</h1>
        </div>
        <select
          className="language-select launch-language"
          value={props.language}
          onChange={(event) => props.onLanguageChange(event.target.value as LanguageName)}
          aria-label={props.t("言語を選ぶ", "Choose language")}
        >
          {languageOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.short} {option.label}
            </option>
          ))}
        </select>
      </header>

      <section className="launch-actions" aria-label={props.t("はじめる", "Get started")}>
        <button className="launch-create-card primary-button" type="button" onClick={props.onCreateRoom}>
          <span>
            <Plus size={40} />
          </span>
          <strong>{props.t("ルームを作る", "Create room")}</strong>
          <em>{props.t("新しいルームを作成してゲームを始めましょう", "Create a new room and start the game")}</em>
          <ChevronRight size={24} />
        </button>

        <button className="launch-join-card" type="button" onClick={() => setIsJoinPage(true)}>
          <div className="section-heading">
            <span className="join-card-icon">
              <LogIn size={34} />
            </span>
            <div>
              <h2>{props.t("ルームに参加", "Join room")}</h2>
              <p>{props.t("招待コードを入力してルームに参加します", "Enter the invitation code and join")}</p>
            </div>
            <ChevronRight size={24} />
          </div>
        </button>
      </section>

      {props.roomSummaries.length > 0 && (
        <details className="launcher-saved">
          <summary>
            <Home size={17} />
            <span>{props.t("保存済みルーム", "Saved rooms")}</span>
            <small>{props.t("必要な時だけ開く", "Open only when needed")}</small>
          </summary>
          <div className="room-list launcher-room-list">
            {props.roomSummaries.map((summary) => {
              const isComplete = summary.currentRaceNumber >= summary.maxRaces && summary.status === "settled";
              return (
                <div className="room-list-row" key={summary.id}>
                  <div>
                    <strong>{summary.name}</strong>
                    <span>
                      {summary.id} / {props.t(`第${summary.currentRaceNumber}/${summary.maxRaces}レース`, `Race ${summary.currentRaceNumber}/${summary.maxRaces}`)}
                    </span>
                  </div>
                  <em className={isComplete ? "complete" : ""}>
                    {isComplete ? props.t("完了", "Done") : props.t("進行中", "Active")}
                  </em>
                  <button className="tertiary-button compact-button" type="button" onClick={() => props.onOpenRoom(summary.id)}>
                    {props.t("開く", "Open")}
                  </button>
                  <button className="danger-button compact-button delete-room-button" type="button" onClick={() => props.onDeleteRoom(summary.id)}>
                    <Trash2 size={15} />
                    {props.t("削除", "Delete")}
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function JoinEntryScreen(props: {
  joinName: string;
  setJoinName: (value: string) => void;
  joinRoomId: string;
  setJoinRoomId: (value: string) => void;
  joinCode: string;
  setJoinCode: (value: string) => void;
  language: LanguageName;
  onLanguageChange: (value: LanguageName) => void;
  roomSummaries: LocalRoomSummary[];
  canJoin: boolean;
  t: Translate;
  onBack: () => void;
  onJoin: () => void;
  onOpenRoom: (roomId: string) => void;
}) {
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>(".phone-frame");
    window.scrollTo({ top: 0, behavior: "auto" });
    frame?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="join-entry-screen">
      <header className="join-entry-header">
        <button className="back-button" type="button" onClick={props.onBack} aria-label={props.t("戻る", "Back")}>
          <ArrowLeft size={26} />
        </button>
        <select
          className="language-select join-language"
          value={props.language}
          onChange={(event) => props.onLanguageChange(event.target.value as LanguageName)}
          aria-label={props.t("言語を選ぶ", "Choose language")}
        >
          {languageOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.short} {option.label}
            </option>
          ))}
        </select>
      </header>

      <section className="join-title">
        <h1>{props.t("ルームに参加", "Join room")}</h1>
        <p>{props.t("招待されたルーム情報を入力してください", "Enter the room details you received")}</p>
      </section>

      <form
        className="join-entry-card"
        onSubmit={(event) => {
          event.preventDefault();
          props.onJoin();
        }}
      >
        <h2>{props.t("参加情報", "Join details")}</h2>
        <label>
          {props.t("表示名", "Display name")}
          <input value={props.joinName} onChange={(event) => props.setJoinName(event.target.value)} placeholder={props.t("例：ゆうた", "Example: Yuta")} />
        </label>
        <label>
          {props.t("ルームID", "Room ID")}
          <input value={props.joinRoomId} onChange={(event) => props.setJoinRoomId(event.target.value.toUpperCase())} placeholder="AB12CD" />
        </label>
        <label>
          {props.t("参加コード", "Join code")}
          <input inputMode="numeric" value={props.joinCode} onChange={(event) => props.setJoinCode(event.target.value)} placeholder="2468" />
        </label>
        <button className="primary-button join-submit" type="submit" disabled={!props.canJoin}>
          {props.t("参加する", "Join")}
        </button>
        <p>{props.t("幹事から共有されたIDとコードを入力してください", "Use the ID and code shared by the host")}</p>
      </form>

      {props.roomSummaries.length > 0 && (
        <button className="saved-room-link" type="button" onClick={() => props.onOpenRoom(props.roomSummaries[0].id)}>
          <Home size={26} />
          <strong>{props.t("保存済みルームから選ぶ", "Choose from saved rooms")}</strong>
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  );
}

function JoinPanel(props: {
  joinName: string;
  setJoinName: (value: string) => void;
  joinRoomId: string;
  setJoinRoomId: (value: string) => void;
  joinCode: string;
  setJoinCode: (value: string) => void;
  onJoin: () => void;
  t: Translate;
}) {
  return (
    <section className="join-panel">
      <div className="section-heading">
        <Users size={20} />
        <div>
          <h2>{props.t("参加する", "Join Room")}</h2>
          <p>{props.t("幹事から共有されたIDとコードを入力", "Enter the ID and code shared by the host")}</p>
        </div>
      </div>
      <label>
        {props.t("名前", "Name")}
        <input value={props.joinName} onChange={(event) => props.setJoinName(event.target.value)} placeholder={props.t("ニックネーム", "Nickname")} />
      </label>
      <label>
        {props.t("ルームID", "Room ID")}
        <input value={props.joinRoomId} onChange={(event) => props.setJoinRoomId(event.target.value)} placeholder="AB12CD" />
      </label>
      <label>
        {props.t("参加コード", "Join code")}
        <input
          inputMode="numeric"
          value={props.joinCode}
          onChange={(event) => props.setJoinCode(event.target.value)}
          placeholder="2468"
        />
      </label>
      <button className="primary-button" type="button" onClick={props.onJoin}>
        {props.t("参加する", "Join")}
        <ChevronRight size={22} />
      </button>
      <p className="join-help">
        {props.t("幹事から届いた招待文のURL、ルームID、参加コードを使います。", "Use the URL, room ID, and join code from the host.")}
      </p>
    </section>
  );
}

function HomeView(props: {
  room: Room;
  ranking: Player[];
  currentRaceNumber: number;
  hasJackpot: boolean;
  publicUrl: string;
  roomSummaries: LocalRoomSummary[];
  t: Translate;
  onCreateRoom: () => void;
  onBetTab: () => void;
  onHostTab: () => void;
  onJoinMode: () => void;
  onResetDemo: () => void;
  onCopyInvite: () => void;
  onOpenRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const betCount = props.room.currentRace.bets.length;

  return (
    <div className="screen-stack">
      <section className="home-dashboard-modern">
        <div className="race-progress-card">
          <span>{props.t("現在のレース", "Current race")}</span>
          <h2>
            {props.t("第", "Race ")}
            <b>{props.currentRaceNumber}</b>
            /{props.room.settings.maxRaces}
            {props.t(" レース", "")}
          </h2>
          <div className="progress-line">
            <span style={{ width: `${Math.max(8, (props.currentRaceNumber / props.room.settings.maxRaces) * 100)}%` }} />
          </div>
          <div className="race-status-grid">
            <div>
              <Trophy size={24} />
              <span>{props.t("ベット完了", "Bets done")}</span>
              <strong>{props.room.currentRace.bets.length} / {props.room.players.length}</strong>
            </div>
            <div>
              <Settings2 size={24} />
              <span>{props.t("結果", "Results")}</span>
              <strong>{props.room.currentRace.resultIds.length ? props.t("入力済み", "Entered") : props.t("未入力", "Not entered")}</strong>
            </div>
            <div>
              <CircleDollarSign size={24} />
              <span>{props.t("精算", "Payout")}</span>
              <strong>{props.room.currentRace.status === "settled" ? props.t("処理済み", "Done") : props.t("未処理", "Pending")}</strong>
            </div>
          </div>
        </div>

        <div className="host-action-list">
          <button className="host-action-card primary-action" type="button" onClick={props.onHostTab}>
            <span><Settings2 size={28} /></span>
            <div>
              <strong>{props.t("結果を入力", "Enter results")}</strong>
              <p>{props.t("着順を入力して精算へ進む", "Enter finish order and move to payouts")}</p>
            </div>
            <ChevronRight size={28} />
          </button>
          <button className="host-action-card" type="button" onClick={props.onHostTab}>
            <span><CircleDollarSign size={27} /></span>
            <div>
              <strong>{props.t("配当を精算", "Settle payouts")}</strong>
              <p>{props.t("配当を反映して残高更新", "Apply payouts and update balances")}</p>
            </div>
            <ChevronRight size={28} />
          </button>
          <button className="host-action-card" type="button" onClick={props.onHostTab}>
            <span><Flag size={27} /></span>
            <div>
              <strong>{props.t("次のレースを開始", "Start next race")}</strong>
              <p>{props.t("次の投票受付を開始", "Open betting for the next race")}</p>
            </div>
            <ChevronRight size={28} />
          </button>
        </div>

        <section className="home-summary-card">
          <div>
            <BarChart3 size={24} />
            <span>{props.t("未対応タスク", "Open tasks")}</span>
            <strong>{props.room.currentRace.status === "settled" ? 0 : props.room.currentRace.resultIds.length ? 1 : 2}{props.t(" 件", "")}</strong>
          </div>
          <div>
            <Users size={24} />
            <span>{props.t("参加者", "Bettors")}</span>
            <strong>{props.room.players.length}{props.t(" 人", "")}</strong>
          </div>
        </section>
      </section>

      <section className={props.room.isDemo ? "race-hero welcome-hero" : "race-hero"}>
        <div>
          <p className="badge">{props.room.isDemo ? props.t("はじめに", "Start here") : props.t("開催中", "Live")}</p>
          <h2>
            {props.room.isDemo
              ? props.t("みんなで遊ぶ予想ゲーム", "A party prediction game")
              : props.t(`第${props.currentRaceNumber}レース`, `Race ${props.currentRaceNumber}`)}
          </h2>
          <p>
            {props.room.isDemo
              ? props.t("まずは遊び方を見て、幹事で始めるか友だちとして参加するかを選んでください。", "Check the flow, then choose host or friend mode.")
              : props.t("友だちのスマホから同じルームに参加できます", "Friends can join this room from their phones")}
          </p>
        </div>
        {!props.room.isDemo && (
          <div className="timer">
            <Radio size={18} />
            <span>{props.t(`第${props.currentRaceNumber}/${props.room.settings.maxRaces}レース`, `Race ${props.currentRaceNumber}/${props.room.settings.maxRaces}`)}</span>
          </div>
        )}
      </section>

      <section className="guide-panel">
        <div className="section-heading">
          <Gamepad2 size={20} />
          <div>
            <h2>{props.t("あそび方", "How to Play")}</h2>
            <p>{props.t("幹事が作って、友だちは参加するだけ", "The host creates a room, friends join and bet")}</p>
          </div>
        </div>
        <div className="guide-steps">
          <span>1</span>
          <strong>{props.t("本番ルーム", "Live room")}</strong>
          <p>{props.t("幹事がルームを作る", "Host creates a room")}</p>
          <span>2</span>
          <strong>{props.t("共有", "Share")}</strong>
          <p>{props.t("URL・ルームID・参加コードを送る", "Send URL, room ID, and code")}</p>
          <span>3</span>
          <strong>{props.t("ベット", "Bet")}</strong>
          <p>{props.t("各スマホ、または幹事代行で入力", "Bet by phone or host proxy")}</p>
        </div>
      </section>

      <section className="mode-cards" aria-label={props.t("開始方法", "Start options")}>
        <button className="mode-card host" type="button" onClick={props.room.isDemo ? props.onCreateRoom : props.onHostTab}>
          <Crown size={22} />
          <span>{props.t("幹事で始める", "Start as host")}</span>
          <strong>{props.room.isDemo ? props.t("本番ルームを作る", "Create live room") : props.t("管理画面を開く", "Open controls")}</strong>
          <ChevronRight size={20} />
        </button>
        <button className="mode-card guest" type="button" onClick={props.onJoinMode}>
          <Users size={22} />
          <span>{props.t("友だちとして参加", "Join as friend")}</span>
          <strong>{props.t("ルームIDとコードを入力", "Enter ID and code")}</strong>
          <ChevronRight size={20} />
        </button>
      </section>

      {!props.room.isDemo && (
        <section className="share-card">
          <div>
            <span>{props.t("共有URL", "Share URL")}</span>
            <strong>{props.publicUrl}</strong>
          </div>
          <div>
            <span>{props.t("ルームID", "Room ID")}</span>
            <strong>{props.room.id}</strong>
          </div>
          <div>
            <span>{props.t("参加コード", "Join code")}</span>
            <strong>{props.room.joinCode}</strong>
          </div>
          <button className="secondary-button full" type="button" onClick={props.onCopyInvite}>
            {props.t("招待をコピー", "Copy invite")}
          </button>
        </section>
      )}

      {props.roomSummaries.length > 0 && (
        <section className="room-list-card">
          <div className="section-heading">
            <Home size={20} />
            <div>
              <h2>{props.t("ルーム一覧", "Room list")}</h2>
              <p>{props.t("終わったルームはここから片付けられます。", "Clean up finished rooms here.")}</p>
            </div>
          </div>
          <div className="room-list">
            {props.roomSummaries.map((summary) => {
              const isCurrent = summary.id === props.room.id;
              const isComplete = summary.currentRaceNumber >= summary.maxRaces && summary.status === "settled";
              return (
                <div className={isCurrent ? "room-list-row current" : "room-list-row"} key={summary.id}>
                  <div>
                    <strong>{summary.name}</strong>
                    <span>
                      {summary.id} / {props.t(`第${summary.currentRaceNumber}/${summary.maxRaces}レース`, `Race ${summary.currentRaceNumber}/${summary.maxRaces}`)}
                    </span>
                  </div>
                  <em className={isComplete ? "complete" : ""}>
                    {isComplete ? props.t("完了", "Done") : props.t("進行中", "Active")}
                  </em>
                  <button className="tertiary-button compact-button" type="button" onClick={() => props.onOpenRoom(summary.id)} disabled={isCurrent}>
                    {isCurrent ? props.t("表示中", "Showing") : props.t("開く", "Open")}
                  </button>
                  <button className="danger-button compact-button delete-room-button" type="button" onClick={() => props.onDeleteRoom(summary.id)}>
                    <Trash2 size={15} />
                    {props.t("削除", "Delete")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {props.hasJackpot && (
        <section className="jackpot">
          <Sparkles size={22} />
          {props.t("大穴的中が出ました", "A big win landed")}
        </section>
      )}

      {!props.room.isDemo && (
        <>
          <section className="metric-grid">
            <Metric icon={<Users size={20} />} label={props.t("参加者", "Bettors")} value={props.room.players.length.toString()} />
            <Metric icon={<Gamepad2 size={20} />} label={props.t("対戦者", "Players")} value={props.room.contestants.length.toString()} />
            <Metric icon={<CircleDollarSign size={20} />} label={props.t("ベット数", "Bets")} value={betCount.toString()} />
          </section>

          <section className="leader-preview">
            <div className="section-heading">
              <Trophy size={20} />
              <div>
                <h2>{props.t("ランキング", "Ranking")}</h2>
                <p>{props.t("保有コイン順でリアルタイム更新", "Updates by current coin balance")}</p>
              </div>
            </div>
            {props.ranking.slice(0, 3).map((player, index) => (
              <PlayerRankRow key={player.id} player={player} rank={index + 1} compact t={props.t} />
            ))}
          </section>

          <section className="action-row">
            <button className="primary-button" type="button" onClick={props.onBetTab}>
              {props.t("ベットへ", "Go bet")}
              <ChevronRight size={22} />
            </button>
            <button className="secondary-button" type="button" onClick={props.onCreateRoom}>
              <Plus size={18} />
              {props.t("新規ルーム", "New room")}
            </button>
            <button className="tertiary-button icon-only" type="button" aria-label={props.t("デモリセット", "Reset demo")} onClick={props.onResetDemo}>
              <RotateCcw size={18} />
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function BetView(props: {
  room: Room;
  sessionRole: "host" | "player";
  activePlayer?: Player;
  proxyPlayerId: string;
  setProxyPlayerId: (value: string) => void;
  selectedContestantId: string;
  setSelectedContestantId: (value: string) => void;
  selectedPickIds: string[];
  onPickContestant: (contestantId: string) => void;
  betType: BetType;
  setBetType: (value: BetType) => void;
  amount: number;
  setAmount: (value: number) => void;
  selectedContestant?: ReturnType<typeof getContestant>;
  potentialPayout: number;
  displayMode: BetDisplayMode;
  setDisplayMode: (value: BetDisplayMode) => void;
  currentRaceNumber: number;
  placedPlayerCount: number;
  allPlayersPlaced: boolean;
  onPickOrder: (contestantIds: string[]) => void;
  onPlaceBet: () => void;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  t: Translate;
}) {
  const available = props.activePlayer ? getAvailableBalance(props.room, props.activePlayer.id) : 0;
  const shownBalance = props.room.settings.allowDebt ? props.activePlayer?.balance ?? 0 : available;
  const activePlayerBetCount = props.activePlayer
    ? props.room.currentRace.bets.filter((bet) => bet.playerId === props.activePlayer?.id).length
    : 0;
  const activePlayerPlaced = activePlayerBetCount > 0;
  const pickCount = requiredPickCount(props.betType);
  const selectedContestants = props.selectedPickIds
    .map((contestantId) => getContestant(props.room, contestantId))
    .filter((contestant): contestant is NonNullable<ReturnType<typeof getContestant>> => Boolean(contestant));
  const statusLabel = props.room.currentRace.status === "settled"
    ? props.t("確定済み", "Settled")
    : props.room.currentRace.status === "closed"
      ? props.t("受付終了", "Closed")
      : props.t("受付中", "Open");
  const isPickComplete = selectedContestants.length === pickCount;
  const smartActionTitle = props.room.currentRace.status !== "betting"
    ? props.t("この勝負は受付中ではありません", "This round is not accepting bets")
    : !props.activePlayer
      ? props.t("ベットする参加者を選ぶ", "Choose the bettor")
      : !isPickComplete
        ? props.t("買い目を選ぶ", "Choose your picks")
        : props.amount <= 0
          ? props.t("ベット額を決める", "Set the bet amount")
          : props.t("この内容でベットできます", "Ready to place this bet");
  const smartActionNote = props.room.currentRace.status !== "betting"
    ? props.t("払戻済みの場合は、管理画面から次の勝負へ進みます。", "If payouts are done, continue from the host controls.")
    : !props.activePlayer
      ? props.t("幹事入力なら、まず代行する参加者を選びます。", "For host entry, select who this bet is for first.")
      : !isPickComplete
        ? props.t(`${pickCount}つの順位枠を埋めると、見込み払戻が確定します。`, `Fill ${pickCount} pick slots to lock the estimated payout.`)
        : props.t(
            `${selectedContestants.map((contestant, index) => `${index + 1}.${contestant.name}`).join(" → ")} / ${currency.format(props.amount)}コイン`,
            `${selectedContestants.map((contestant, index) => `${index + 1}. ${contestant.name}`).join(" -> ")} / ${currency.format(props.amount)} coins`,
          );
  const smartMeterNote = props.room.currentRace.status !== "betting"
    ? props.t("停止中", "Closed")
    : !props.activePlayer
      ? props.t("参加者未選択", "No bettor")
      : isPickComplete && props.amount > 0
        ? `${props.potentialPayout.toLocaleString()} ${props.t("見込み", "est.")}`
        : props.t("未完了", "Open");
  const playerPhase = props.room.currentRace.status === "settled"
    ? "settled"
    : activePlayerPlaced
      ? props.allPlayersPlaced
        ? "all-ready"
        : "waiting"
      : "betting";
  const playerPhaseCopy: Record<string, { title: string; note: string; badge: string }> = {
    betting: {
      badge: props.t("ベット受付中", "Betting open"),
      title: props.t("買い目と金額を決める", "Pick your ticket and amount"),
      note: props.t("送信したら結果待ちに変わります。", "After submitting, this changes to waiting for results."),
    },
    waiting: {
      badge: props.t("ベット済み", "Bet placed"),
      title: props.t("ほかの参加者を待っています", "Waiting for the other players"),
      note: props.t(`現在 ${props.placedPlayerCount}/${props.room.players.length}人がベット済みです。`, `${props.placedPlayerCount}/${props.room.players.length} players have bet.`),
    },
    "all-ready": {
      badge: props.t("全員完了", "All set"),
      title: props.t("結果入力待ちです", "Waiting for results"),
      note: props.t("幹事が順位を入れると、自動で払戻画面へ進みます。", "When the host enters results, you will move to payouts automatically."),
    },
    settled: {
      badge: props.t("払戻確定", "Payout settled"),
      title: props.t("結果とランキングを確認", "Check results and ranking"),
      note: props.t("順位タブで今回の払戻と現在の順位を見られます。", "Use the ranking tab to see payouts and standings."),
    },
  };
  const canPlaceBet =
    props.room.currentRace.status === "betting" &&
    Boolean(props.activePlayer) &&
    isPickComplete &&
    props.amount > 0 &&
    !(props.sessionRole === "player" && activePlayerPlaced);
  const placeButtonLabel = props.room.currentRace.status !== "betting"
    ? props.t("受付停止中", "Betting closed")
    : props.sessionRole === "player" && activePlayerPlaced
      ? props.t("ベット済み", "Bet placed")
      : props.t("ベットする", "Place Bet");

  return (
    <div className="screen-stack">
      {props.sessionRole === "player" && (
        <section className={`player-phase-panel ${playerPhase}`}>
          <div className="phase-steps" aria-label={props.t("進行状況", "Progress")}>
            <span className={playerPhase === "betting" ? "active" : "done"}>1</span>
            <span className={playerPhase === "waiting" || playerPhase === "all-ready" ? "active" : playerPhase === "settled" ? "done" : ""}>2</span>
            <span className={playerPhase === "settled" ? "active" : ""}>3</span>
          </div>
          <div>
            <em>{playerPhaseCopy[playerPhase].badge}</em>
            <strong>{playerPhaseCopy[playerPhase].title}</strong>
            <p>{playerPhaseCopy[playerPhase].note}</p>
          </div>
        </section>
      )}

      <section className="bet-hero-2026">
        <div className="bet-hero-title">
          <div>
            <span>第 <b>{props.currentRaceNumber}</b> レース</span>
            <em>{statusLabel}</em>
          </div>
          <button type="button">
            <Settings2 size={18} />
            レース情報
          </button>
        </div>
        <p>
          {props.betType === "win"
            ? "1着になる順位を予想してください"
            : props.betType === "place"
              ? "上位に入る対戦者を予想してください"
              : props.betType === "exacta"
                ? "1着・2着の順番を予想してください"
                : "1着・2着・3着の順番を予想してください"}
        </p>
      </section>

      <section className={props.room.isDemo ? "race-mini two-up" : "race-mini"}>
        <div>
          <span>{props.t("現在の勝負", "Current round")}</span>
          <strong>{props.t(`第${props.currentRaceNumber}/${props.room.settings.maxRaces}レース`, `Race ${props.currentRaceNumber}/${props.room.settings.maxRaces}`)}</strong>
        </div>
        <div>
          <span>{props.t("状態", "Status")}</span>
          <strong>{statusLabel}</strong>
        </div>
      </section>

      {props.sessionRole === "host" && (
        <section className="proxy-strip">
          <div className="section-heading">
            <UserPlus size={20} />
            <div>
              <h2>{props.t("ベット入力する参加者", "Bettor to enter")}</h2>
              <p>{props.t("幹事本人が賭ける場合も、参加者に自分を追加して選びます。", "If the host also bets, add yourself as a bettor and select that name.")}</p>
            </div>
          </div>
          <select value={props.proxyPlayerId} onChange={(event) => props.setProxyPlayerId(event.target.value)}>
            <option value="">{props.t("代行なし / 参加者を選択", "No proxy / choose bettor")}</option>
            {props.room.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.isOffline ? ` / ${props.t("代行", "Proxy")}` : ""}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="balance-banner">
        <div>
          <span>{props.t("参加者", "Bettor")}</span>
          <strong>{props.activePlayer ? `${props.activePlayer.emoji} ${props.activePlayer.name}` : props.t("未選択", "Not selected")}</strong>
        </div>
        <div>
          <span>{props.room.settings.allowDebt ? props.t("現在コイン", "Balance") : props.t("残コイン", "Available")}</span>
          <strong>{currency.format(shownBalance)}</strong>
        </div>
      </section>

      <section className="smart-action-card" aria-label={props.t("次にやること", "Next action")}>
        <div>
          <span>{props.t("次にやること", "Next action")}</span>
          <strong>{smartActionTitle}</strong>
          <p>{smartActionNote}</p>
        </div>
        <div className="smart-action-meter">
          <span>{props.t("選択", "Picks")}</span>
          <strong>{selectedContestants.length}/{pickCount}</strong>
          <em>{smartMeterNote}</em>
        </div>
      </section>

      <section className="bet-type-grid">
        {(["win", "place", "exacta", "trifecta"] as BetType[]).map((type) => (
          <button
            className={props.betType === type ? "bet-type selected" : "bet-type"}
            key={type}
            type="button"
            onClick={() => props.setBetType(type)}
          >
            {type === "win" || type === "exacta" ? <Trophy size={22} /> : <Medal size={22} />}
            <strong>{props.betTypeLabels[type].title}</strong>
            <span>{props.betTypeLabels[type].note}</span>
          </button>
        ))}
      </section>

      <SegmentedControl
        ariaLabel={props.t("表示切り替え", "View mode")}
        value={props.displayMode}
        onChange={props.setDisplayMode}
        options={[
          { value: "board", label: props.t("馬券表", "Ticket board") },
          { value: "cards", label: props.t("カード", "Cards") },
        ]}
      />

      {props.displayMode === "board" ? (
        <TicketBoard
          room={props.room}
          betType={props.betType}
          selectedPickIds={props.selectedPickIds}
          onPickContestant={props.onPickContestant}
          onPickOrder={props.onPickOrder}
          t={props.t}
        />
      ) : (
        <section className="contestant-list">
          {props.room.contestants.map((contestant, index) => {
            const selectedIndex = props.selectedPickIds.indexOf(contestant.id);
            const isSelected = selectedIndex >= 0;
            const cardValue = pickCount === 1
              ? `${getEffectiveMultiplier(props.room, props.betType, [contestant]).toFixed(2)}x`
              : isSelected
                ? props.t(`${selectedIndex + 1}位`, `#${selectedIndex + 1}`)
                : props.t("選択", "Pick");
            return (
              <button
                className={isSelected ? "contestant selected" : "contestant"}
                key={contestant.id}
                type="button"
                onClick={() => props.onPickContestant(contestant.id)}
              >
                <span className="rank-chip">{index + 1}</span>
                <span className="avatar" style={{ "--accent": contestant.accent } as CSSProperties}>
                  {contestant.icon}
                </span>
                <span className="contestant-name">{contestant.name}</span>
                <strong>{cardValue}</strong>
                <span className="select-circle">{isSelected ? `${selectedIndex + 1}` : ""}</span>
              </button>
            );
          })}
        </section>
      )}

      {pickCount > 1 && (
        <section className="order-ticket" style={{ "--pick-count": pickCount } as CSSProperties}>
          {Array.from({ length: pickCount }).map((_, index) => {
            const contestant = selectedContestants[index];
            return (
              <div key={index}>
                <span>{props.t(`${index + 1}位`, `#${index + 1}`)}</span>
                <strong>{contestant?.name ?? props.t("未選択", "Not selected")}</strong>
              </div>
            );
          })}
        </section>
      )}

      <section className="payout-preview">
        <div>
          <Sparkles size={24} />
          <span>{props.t("的中時の獲得見込み", "Estimated win")}</span>
        </div>
        <strong>{currency.format(props.potentialPayout)} {props.t("コイン", "coins")}</strong>
      </section>

      <section className="amount-panel">
        <div className="amount-header">
          <span>{props.t("ベット額", "Bet amount")}</span>
          <strong>
            {selectedContestants.length === pickCount
              ? `${getEffectiveMultiplier(props.room, props.betType, selectedContestants).toFixed(2)}x`
              : "-"}
          </strong>
        </div>
        <div className="stepper">
          <button type="button" onClick={() => props.setAmount(Math.max(0, props.amount - 10))} aria-label={props.t("ベット額を減らす", "Decrease bet amount")}>
            <Minus size={20} />
          </button>
          <div>
            <strong>{currency.format(props.amount)}</strong>
            <span>{props.t("コイン", "coins")}</span>
          </div>
          <button type="button" onClick={() => props.setAmount(props.amount + 10)} aria-label={props.t("ベット額を増やす", "Increase bet amount")}>
            <Plus size={20} />
          </button>
        </div>
        <div className="quick-grid amount-adjust-grid">
          {quickAmounts.map((quickAmount) => (
            <button
              className="minus-quick"
              key={`minus-${quickAmount}`}
              type="button"
              onClick={() => props.setAmount(Math.max(0, props.amount - quickAmount))}
            >
              -{currency.format(quickAmount)}
            </button>
          ))}
          {quickAmounts.map((quickAmount) => (
            <button
              className="plus-quick"
              key={`plus-${quickAmount}`}
              type="button"
              onClick={() => props.setAmount(props.amount + quickAmount)}
            >
              +{currency.format(quickAmount)}
            </button>
          ))}
          <button className="balance-quick" type="button" onClick={() => props.setAmount(Math.max(0, shownBalance))}>
            {props.t("所持分", "Balance")}
          </button>
        </div>
      </section>

      <button className="primary-button sticky-action" type="button" onClick={props.onPlaceBet} disabled={!canPlaceBet}>
        {placeButtonLabel}
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

function TicketBoard(props: {
  room: Room;
  betType: BetType;
  selectedPickIds: string[];
  onPickContestant: (contestantId: string) => void;
  onPickOrder: (contestantIds: string[]) => void;
  t: Translate;
}) {
  const contestants = props.room.contestants;
  const pairPickIds = props.selectedPickIds.slice(0, 2);
  const thirdPickId = props.selectedPickIds[2];

  if (props.betType === "win" || props.betType === "place") {
    return (
      <section className="ticket-board single">
        <div className="ticket-board-head">
          <span>{props.t("番号", "No.")}</span>
          <span>{props.t("出走者", "Contestant")}</span>
          <span>{props.t("倍率", "Odds")}</span>
        </div>
        {contestants.map((contestant, index) => (
          <button
            className={props.selectedPickIds[0] === contestant.id ? "ticket-row selected" : "ticket-row"}
            key={contestant.id}
            type="button"
            onClick={() => props.onPickContestant(contestant.id)}
          >
            <span className="horse-number" style={{ "--accent": contestant.accent } as CSSProperties}>
              {index + 1}
            </span>
            <strong>{contestant.icon} {contestant.name}</strong>
            <span>{getEffectiveMultiplier(props.room, props.betType, [contestant]).toFixed(2)}x</span>
          </button>
        ))}
      </section>
    );
  }

  return (
    <section className="ticket-board matrix">
      <div className="matrix-scroll" style={{ "--matrix-count": contestants.length } as CSSProperties}>
        <div className="matrix-corner">{props.t("1着", "1st")}</div>
        {contestants.map((contestant, index) => (
          <div className="matrix-head" key={contestant.id} style={{ "--accent": contestant.accent } as CSSProperties}>
            {index + 1}
          </div>
        ))}
        {contestants.map((row, rowIndex) => (
          <div className="matrix-row-fragment" key={row.id}>
            <div className="matrix-side" style={{ "--accent": row.accent } as CSSProperties}>
              <span>{rowIndex + 1}</span>
              <strong>{row.name}</strong>
            </div>
            {contestants.map((column, columnIndex) => {
              const disabled = row.id === column.id;
              const selected = pairPickIds[0] === row.id && pairPickIds[1] === column.id;
              const pairMultiplier = props.betType === "exacta" ? getEffectiveMultiplier(props.room, "exacta", [row, column]) : null;
              return (
                <button
                  className={selected ? "matrix-cell selected" : "matrix-cell"}
                  disabled={disabled}
                  key={`${row.id}-${column.id}`}
                  type="button"
                  onClick={() => {
                    const third = thirdPickId && thirdPickId !== row.id && thirdPickId !== column.id ? thirdPickId : "";
                    props.onPickOrder(props.betType === "trifecta" ? [row.id, column.id, third].filter(Boolean) : [row.id, column.id]);
                  }}
                >
                  {disabled ? "" : (
                    <>
                      <span>{rowIndex + 1}-{columnIndex + 1}</span>
                      <strong>{pairMultiplier ? `${pairMultiplier.toFixed(1)}x` : props.t("3着へ", "Pick 3rd")}</strong>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {props.betType === "trifecta" && (
        <div className="third-pick-strip">
          <span>{props.t("3着", "3rd")}</span>
          {contestants.map((contestant, index) => {
            const disabled = pairPickIds.includes(contestant.id) || pairPickIds.length < 2;
            const first = getContestant(props.room, pairPickIds[0]);
            const second = getContestant(props.room, pairPickIds[1]);
            const trifectaMultiplier = !disabled && first && second
              ? getEffectiveMultiplier(props.room, "trifecta", [first, second, contestant])
              : 0;
            return (
              <button
                className={thirdPickId === contestant.id ? "selected" : ""}
                disabled={disabled}
                key={contestant.id}
                type="button"
                onClick={() => props.onPickOrder([pairPickIds[0], pairPickIds[1], contestant.id].filter(Boolean))}
              >
                <strong>{index + 1}</strong>
                {trifectaMultiplier > 0 && <small>{trifectaMultiplier.toFixed(1)}x</small>}
              </button>
            );
          })}
        </div>
      )}
      <p className="board-note">
        {props.betType === "trifecta"
          ? props.t("表で1着-2着を選び、下で3着を選びます。", "Pick 1st-2nd in the board, then 3rd below.")
          : props.t("表のマスで1着-2着の順番を選びます。", "Tap a cell to pick 1st-2nd in order.")}
      </p>
    </section>
  );
}

function HostView(props: {
  room: Room;
  newPlayerName: string;
  setNewPlayerName: (value: string) => void;
  newPlayerOffline: boolean;
  setNewPlayerOffline: (value: boolean) => void;
  newPlayerEmoji: string;
  setNewPlayerEmoji: (value: string) => void;
  newContestantName: string;
  setNewContestantName: (value: string) => void;
  newContestantOdds: number;
  setNewContestantOdds: (value: number) => void;
  newContestantCpuLevel: number;
  setNewContestantCpuLevel: (value: number) => void;
  newContestantIsCpu: boolean;
  setNewContestantIsCpu: (value: boolean) => void;
  newContestantEmoji: string;
  setNewContestantEmoji: (value: string) => void;
  bonusPlayerId: string;
  setBonusPlayerId: (value: string) => void;
  bonusAmount: number;
  setBonusAmount: (value: number) => void;
  resultIds: string[];
  themeCopy: Record<ThemeName, { label: string; note: string }>;
  uiModeCopy: Record<UiModeName, { label: string; note: string; tag: string }>;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  currentRaceNumber: number;
  placedPlayerCount: number;
  allPlayersPlaced: boolean;
  t: Translate;
  onAddPlayer: () => void;
  onDeletePlayer: (playerId: string) => void;
  onAddContestant: () => void;
  onOddsChange: (contestantId: string, odds: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onUiModeChange: (uiMode: UiModeName) => void;
  onRoomNameChange: (name: string) => void;
  onStartingBalanceChange: (value: number) => void;
  onPlayerEmojiChange: (playerId: string, emoji: string) => void;
  onContestantLevelChange: (
    contestantId: string,
    patch: Partial<{ cpuLevel: number; isCpu: boolean; icon: string }>,
  ) => void;
  onSettingChange: (
    key: "maxPlayers" | "maxContestants" | "autoOdds" | "marketOdds" | "allowDebt" | "maxRaces" | "specialBonus",
    value: number | boolean,
  ) => void;
  onAutoOdds: () => void;
  onGrantBonus: () => void;
  onResultPick: (contestantId: string) => void;
  onSettle: () => void;
  onNextRace: () => void;
}) {
  const [hostSection, setHostSection] = useState<HostSection>("progress");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector<HTMLElement>(".phone-frame")?.scrollTo({ top: 0, behavior: "auto" });
  }, [hostSection]);

  const hostTabs: Array<{ key: HostSection; label: string; note: string; icon: ReactNode }> = [
    { key: "progress", label: props.t("進行", "Run"), note: props.t("結果入力とベット確認", "Results and bets"), icon: <Trophy size={18} /> },
    { key: "settings", label: props.t("設定", "Setup"), note: props.t("勝負名・ルール", "Name and rules"), icon: <Lock size={18} /> },
    { key: "players", label: props.t("参加者", "Bettors"), note: props.t("代行・ボーナス", "Proxy and bonus"), icon: <Users size={18} /> },
    { key: "contestants", label: props.t("対戦者", "Racers"), note: props.t("CPU・倍率", "CPU and odds"), icon: <Gamepad2 size={18} /> },
  ];
  const hostSectionClass = (section: HostSection) => `host-panel ${hostSection === section ? "" : "host-hidden"}`;
  const resultProgress = `${props.resultIds.length}/${props.room.contestants.length}`;
  const hostNextTitle = props.room.currentRace.status === "settled"
    ? props.currentRaceNumber >= props.room.settings.maxRaces
      ? props.t("最終ランキングを確認", "Check final ranking")
      : props.t("次の勝負へ進む", "Start the next round")
    : props.resultIds.length === props.room.contestants.length
      ? props.t("払戻を反映する", "Apply payouts")
      : props.allPlayersPlaced
        ? props.t("全員のベットが揃いました", "All bets are in")
        : props.resultIds.length > 0
          ? props.t(`第${props.currentRaceNumber}レースの順位を続ける`, `Continue Race ${props.currentRaceNumber} results`)
          : props.t("ベット受付中です", "Betting is open");
  const hostNextNote = props.room.currentRace.status === "settled"
    ? props.t("この勝負の払戻は反映済みです。続けるなら次の勝負へ進みます。", "Payouts are applied. Continue when you are ready.")
    : props.resultIds.length === props.room.contestants.length
      ? props.t("順位入力は完了しています。下の主ボタンでこの勝負の収支を確定します。", "Results are complete. Use the primary button below to settle this round.")
      : props.allPlayersPlaced
        ? props.t("参加者全員がベット済みです。レース後に順位をタップして入力します。", "Every bettor has placed a bet. After the round, tap racers in finish order.")
        : props.resultIds.length > 0
          ? props.t("順位をタップした順に1位から入ります。全員分そろうと払戻できます。", "Tap racers in finish order. Once all are set, payouts can be applied.")
          : props.t(`現在 ${props.placedPlayerCount}/${props.room.players.length}人がベット済みです。参加者画面は自動で結果待ちへ進みます。`, `${props.placedPlayerCount}/${props.room.players.length} players have bet. Player screens move to waiting automatically.`);
  const hostNextTone = props.room.currentRace.status === "settled"
    ? "ready"
    : props.resultIds.length === props.room.contestants.length
      ? "urgent"
      : props.allPlayersPlaced
        ? "ready"
        : "open";

  return (
    <div className={`screen-stack host-stack host-section-${hostSection}`}>
      <section className="host-progress-hero">
        <span className="hero-kicker">現在のレース</span>
        <h2>
          第 <b>{props.currentRaceNumber}</b> / {props.room.settings.maxRaces} レース
        </h2>
        <div className="hero-progress-line" aria-hidden="true">
          <span style={{ width: `${Math.max(7, (props.currentRaceNumber / props.room.settings.maxRaces) * 100)}%` }} />
        </div>
        <div className="host-progress-stats">
          <div>
            <Trophy size={24} />
            <span>ベット完了</span>
            <strong>{props.placedPlayerCount} / {props.room.players.length}</strong>
          </div>
          <div>
            <Settings2 size={24} />
            <span>結果</span>
            <strong>{props.resultIds.length === props.room.contestants.length ? "入力済み" : "未入力"}</strong>
          </div>
          <div>
            <CircleDollarSign size={24} />
            <span>精算</span>
            <strong>{props.room.currentRace.status === "settled" ? "処理済み" : "未処理"}</strong>
          </div>
        </div>
      </section>

      <section className={`host-next-card ${hostNextTone}`}>
        <div className="host-next-copy">
          <span>{props.t("今やること", "Next up")}</span>
          <strong>{hostNextTitle}</strong>
          <p>{hostNextNote}</p>
        </div>
        <div className="host-next-metrics">
          <div>
            <span>{props.t("レース", "Race")}</span>
            <strong>{props.currentRaceNumber}/{props.room.settings.maxRaces}</strong>
          </div>
          <div>
            <span>{props.t("ベット", "Bets")}</span>
            <strong>{props.placedPlayerCount}/{props.room.players.length}</strong>
          </div>
          <div>
            <span>{props.t("順位", "Ranks")}</span>
            <strong>{resultProgress}</strong>
          </div>
        </div>
      </section>

      <section className="host-panel host-nav-panel">
        <div className="section-heading">
          <Settings2 size={20} />
          <div>
            <h2>{props.t("管理メニュー", "Host Menu")}</h2>
            <p>{props.t("必要な操作だけ開くと、結果入力まで迷いにくくなります。", "Open only the area you need to keep the flow clear.")}</p>
          </div>
        </div>
        <div className="host-tabbar" role="tablist" aria-label={props.t("管理メニュー", "Host menu")}>
          {hostTabs.map((tab) => (
            <button
              aria-selected={hostSection === tab.key}
              className={hostSection === tab.key ? "selected" : ""}
              key={tab.key}
              type="button"
              onClick={() => setHostSection(tab.key)}
            >
              {tab.icon}
              <strong>{tab.label}</strong>
              <span>{tab.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={`${hostSectionClass("progress")} host-stage-actions`}>
        <button
          className="host-stage-card primary-stage"
          type="button"
          onClick={() => document.getElementById("host-result-entry")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span><Settings2 size={30} /></span>
          <div>
            <strong>結果を入力</strong>
            <p>着順を入力して精算へ進む</p>
          </div>
          <ChevronRight size={28} />
        </button>
        <button
          className="host-stage-card"
          type="button"
          disabled={props.resultIds.length !== props.room.contestants.length || props.room.currentRace.status === "settled"}
          onClick={props.onSettle}
        >
          <span><CircleDollarSign size={28} /></span>
          <div>
            <strong>配当を精算</strong>
            <p>配当を反映して残高更新</p>
          </div>
          <ChevronRight size={28} />
        </button>
        <button
          className="host-stage-card"
          type="button"
          disabled={props.room.currentRace.status !== "settled"}
          onClick={props.onNextRace}
        >
          <span><Flag size={28} /></span>
          <div>
            <strong>{props.currentRaceNumber >= props.room.settings.maxRaces ? "最終順位を見る" : "次のレースを開始"}</strong>
            <p>{props.currentRaceNumber >= props.room.settings.maxRaces ? "ランキングで最終結果を確認" : "次の投票受付を開始"}</p>
          </div>
          <ChevronRight size={28} />
        </button>
        <div className="host-mini-summary">
          <div>
            <BarChart3 size={24} />
            <span>未対応タスク</span>
            <strong>{props.room.currentRace.status === "settled" ? 0 : props.resultIds.length === props.room.contestants.length ? 1 : 2}件</strong>
          </div>
          <div>
            <Users size={24} />
            <span>参加者</span>
            <strong>{props.room.players.length}人</strong>
          </div>
        </div>
      </section>

      <section className={hostSectionClass("settings")}>
        <div className="section-heading">
          <Lock size={20} />
          <div>
            <h2>{props.t("幹事メニュー", "Host Controls")}</h2>
            <p>{props.t("ルームID", "Room ID")} {props.room.id} / {props.t("参加コード", "Join code")} {props.room.joinCode}</p>
          </div>
        </div>
        <label className="room-name-field">
          {props.t("勝負名", "Match name")}
          <input value={props.room.name} onChange={(event) => props.onRoomNameChange(event.target.value)} placeholder={props.t("例: スマブラ王決定戦", "Example: Smash Finals")} />
        </label>
        <div className="subsection-heading">
          <strong>{props.t("操作フロー", "Interaction flow")}</strong>
          <span>{props.t("迷わず進められる新しい画面構成で固定しています。", "The app now uses the guided modern flow by default.")}</span>
        </div>
        <div className="ui-mode-grid">
          {uiModeOrder.map((uiMode) => (
            <button
              className={props.room.uiMode === uiMode ? "ui-mode-card selected" : "ui-mode-card"}
              key={uiMode}
              type="button"
              onClick={() => props.onUiModeChange(uiMode)}
            >
              <span>{props.uiModeCopy[uiMode].tag}</span>
              <strong>{props.uiModeCopy[uiMode].label}</strong>
              <em>{props.uiModeCopy[uiMode].note}</em>
            </button>
          ))}
        </div>
        <div className="subsection-heading">
          <strong>{props.t("配色テーマ", "Color theme")}</strong>
          <span>{props.t("標準のライトテーマと、暗い場所向けのダークテーマだけを選べます。", "Choose between the default light theme and the dark theme for low-light play.")}</span>
        </div>
        <div className="theme-grid">
          {themeOrder.map((theme) => (
            <button
              className={props.room.theme === theme ? "theme-card selected" : "theme-card"}
              key={theme}
              type="button"
              onClick={() => props.onThemeChange(theme)}
            >
              <strong>{props.themeCopy[theme].label}</strong>
              <span>{props.themeCopy[theme].note}</span>
            </button>
          ))}
        </div>
        <div className="settings-grid">
          <label>
            {props.t("参加者", "Bettors")}
            <input
              type="number"
              min="1"
              max="8"
              value={props.room.settings.maxPlayers}
              onChange={(event) => props.onSettingChange("maxPlayers", Number(event.target.value))}
            />
          </label>
          <label>
            {props.t("対戦者", "Contestants")}
            <input
              type="number"
              min="1"
              max="8"
              value={props.room.settings.maxContestants}
              onChange={(event) => props.onSettingChange("maxContestants", Number(event.target.value))}
            />
          </label>
          <label>
            {props.t("初期コイン", "Starting coins")}
            <input
              type="number"
              step="10"
              value={props.room.startingBalance}
              onChange={(event) => props.onStartingBalanceChange(Number(event.target.value))}
            />
          </label>
          <label>
            {props.t("最終レース", "Final race")}
            <input
              type="number"
              min="1"
              max="15"
              value={props.room.settings.maxRaces}
              onChange={(event) => props.onSettingChange("maxRaces", Number(event.target.value))}
            />
          </label>
          <label className="toggle-label wide">
            <input
              type="checkbox"
              checked={props.room.settings.autoOdds}
              onChange={(event) => props.onSettingChange("autoOdds", event.target.checked)}
            />
            {props.t("自動オッズ", "Auto odds")}
          </label>
          <label className="toggle-label wide">
            <input
              type="checkbox"
              checked={props.room.settings.marketOdds}
              onChange={(event) => props.onSettingChange("marketOdds", event.target.checked)}
            />
            {props.t("BET量で倍率を変動", "Move odds by bet pool")}
          </label>
          <label className="toggle-label wide">
            <input
              type="checkbox"
              checked={props.room.settings.allowDebt}
              onChange={(event) => props.onSettingChange("allowDebt", event.target.checked)}
            />
            {props.t("マイナス残高でもBETを続ける", "Allow debt betting")}
          </label>
        </div>
        <button className="secondary-button full" type="button" onClick={props.onAutoOdds}>
          <Sparkles size={18} />
          {props.t("CPU Lvから倍率更新", "Update odds from CPU Lv")}
        </button>
        <p className="host-note">
          {props.t(
            "自動オッズはCPU Lvから初期勝率を作ります。払戻はBET時に表示されていた倍率で計算します。",
            "Auto odds estimate base win rates from CPU Lv. Payouts use the multiplier shown when the bet is placed.",
          )}
        </p>
      </section>

      <section className={hostSectionClass("players")}>
        <div className="section-heading">
          <Users size={20} />
          <div>
            <h2>{props.t("参加者", "Bettors")}</h2>
            <p>{props.t("代行入力する人もここで登録", "Register proxy players here too")}</p>
          </div>
        </div>
        <div className="inline-form participant-form">
          <input value={props.newPlayerName} onChange={(event) => props.setNewPlayerName(event.target.value)} placeholder={props.t("名前", "Name")} />
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={props.newPlayerOffline}
              onChange={(event) => props.setNewPlayerOffline(event.target.checked)}
            />
            {props.t("代行", "Proxy")}
          </label>
          <button className="add-button" type="button" onClick={props.onAddPlayer} aria-label={props.t("参加者を追加", "Add bettor")}>
            <Plus size={18} />
            {props.t("追加", "Add")}
          </button>
        </div>
        <EmojiPicker value={props.newPlayerEmoji} onChange={props.setNewPlayerEmoji} label={props.t("追加する参加者のアイコン", "Icon for the new bettor")} />
        <div className="player-grid">
          {props.room.players.map((player) => (
            <div className="mini-player" key={player.id}>
              <span className="avatar" style={{ "--accent": player.accent } as CSSProperties}>
                {player.emoji}
              </span>
              <strong>{player.name}</strong>
              <span className="player-meta">{player.isOffline ? props.t("代行入力", "Proxy entry") : props.t("本人参加", "Self entry")} / {currency.format(player.balance)}{props.t("コイン", " coins")}</span>
              <EmojiPicker
                value={player.emoji}
                onChange={(emoji) => props.onPlayerEmojiChange(player.id, emoji)}
                label={props.t(`${player.name}のアイコン`, `${player.name}'s icon`)}
                compact
              />
              <button className="delete-player-button" type="button" onClick={() => props.onDeletePlayer(player.id)}>
                <Trash2 size={16} />
                {props.t("削除", "Delete")}
              </button>
            </div>
          ))}
        </div>
        <div className="bonus-panel">
          <div>
            <strong>{props.t("特別ボーナス", "Special bonus")}</strong>
            <span>{props.t("1位ボーナスや借金返済などを幹事が手動で反映できます。", "Host can grant winner bonuses or debt relief manually.")}</span>
          </div>
          <select value={props.bonusPlayerId} onChange={(event) => props.setBonusPlayerId(event.target.value)}>
            {props.room.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="10"
            value={props.bonusAmount}
            onChange={(event) => {
              const next = Number(event.target.value);
              props.setBonusAmount(Number.isFinite(next) ? next : 0);
              props.onSettingChange("specialBonus", Number.isFinite(next) ? next : 0);
            }}
          />
          <button className="secondary-button" type="button" onClick={props.onGrantBonus}>
            <Plus size={18} />
            {props.t("付与", "Grant")}
          </button>
        </div>
      </section>

      <section className={hostSectionClass("contestants")}>
        <div className="section-heading">
          <Settings2 size={20} />
          <div>
            <h2>{props.t("オッズ設定", "Odds Settings")}</h2>
            <p>{props.t("CPU Lv 1〜11に合わせて自動、または倍率を手動調整", "Auto-adjust by CPU Lv 1-11 or edit odds manually")}</p>
          </div>
        </div>
        <p className="host-note compact-note">
          {props.t(
            `現在 ${props.room.contestants.length}/${props.room.settings.maxContestants}人。名前を空欄で追加するとCPU名を自動で作ります。`,
            `${props.room.contestants.length}/${props.room.settings.maxContestants} racers. Leave the name blank to auto-create a CPU name.`,
          )}
        </p>
        <div className="inline-form contestant-form">
          <input
            value={props.newContestantName}
            onChange={(event) => props.setNewContestantName(event.target.value)}
            placeholder={props.t("対戦者名（空欄でCPU自動）", "Racer name (blank for CPU)")}
          />
          <select
            className="small-input"
            value={props.newContestantCpuLevel}
            onChange={(event) => props.setNewContestantCpuLevel(Number(event.target.value))}
            aria-label={props.t("CPUレベル", "CPU level")}
          >
            {levelChoices.map((level) => (
              <option value={level} key={level}>
                Lv {level}
              </option>
            ))}
          </select>
          <input
            className="odds-input"
            type="number"
            min="1.01"
            step="0.01"
            value={props.newContestantOdds}
            onChange={(event) => props.setNewContestantOdds(Number(event.target.value))}
          />
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={props.newContestantIsCpu}
              onChange={(event) => props.setNewContestantIsCpu(event.target.checked)}
            />
            {props.t("CPU", "CPU")}
          </label>
          <button className="add-button" type="button" onClick={props.onAddContestant} aria-label={props.t("対戦者を追加", "Add contestant")}>
            <Plus size={18} />
            {props.t("追加", "Add")}
          </button>
        </div>
        <EmojiPicker value={props.newContestantEmoji} onChange={props.setNewContestantEmoji} label={props.t("追加する対戦者のアイコン", "Icon for the new contestant")} />
        {props.room.contestants.map((contestant) => (
          <div className="odds-row expanded" key={contestant.id}>
            <span className="avatar" style={{ "--accent": contestant.accent } as CSSProperties}>
              {contestant.icon}
            </span>
            <strong>{contestant.name}</strong>
            <label className="toggle-label compact">
              <input
                type="checkbox"
                checked={contestant.isCpu}
                onChange={(event) => props.onContestantLevelChange(contestant.id, { isCpu: event.target.checked })}
              />
              {props.t("CPU", "CPU")}
            </label>
            <label>
              Lv
              <select
                value={contestant.cpuLevel}
                onChange={(event) =>
                  props.onContestantLevelChange(contestant.id, { cpuLevel: Number(event.target.value) })
                }
                aria-label={props.t("CPUレベル", "CPU level")}
              >
                {levelChoices.map((level) => (
                  <option value={level} key={level}>
                    Lv {level}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={contestant.odds}
              onChange={(event) => props.onOddsChange(contestant.id, Number(event.target.value))}
            />
            <EmojiPicker
              value={contestant.icon}
              onChange={(emoji) => props.onContestantLevelChange(contestant.id, { icon: emoji })}
              label={props.t(`${contestant.name}のアイコン`, `${contestant.name}'s icon`)}
              compact
            />
          </div>
        ))}
      </section>

      <section className={`${hostSectionClass("progress")} host-result-entry-panel`} id="host-result-entry">
        <div className="section-heading">
          <Trophy size={20} />
          <div>
            <h2>{props.t(`第${props.currentRaceNumber}レース 結果入力`, `Race ${props.currentRaceNumber} Results`)}</h2>
            <p>{props.t("毎回の勝負後に順位を入れて、払戻を反映します。", "After each round, enter ranks and apply payouts.")}</p>
          </div>
        </div>
        <div className="result-flow">
          <span className={props.room.currentRace.status === "settled" ? "done" : "active"}>{props.t("1. 順位入力", "1. Rank")}</span>
          <span className={props.room.currentRace.status === "settled" ? "done" : ""}>{props.t("2. 払戻反映", "2. Payout")}</span>
          <span className={props.room.currentRace.status === "settled" ? "active" : ""}>
            {props.currentRaceNumber >= props.room.settings.maxRaces
              ? props.t("3. 最終結果", "3. Final")
              : props.t("3. 次の勝負", "3. Next")}
          </span>
        </div>
        <div className="result-picks">
          {props.room.contestants.map((contestant) => {
            const position = props.resultIds.indexOf(contestant.id);
            return (
              <button
                className={position >= 0 ? "result-chip selected" : "result-chip"}
                type="button"
                key={contestant.id}
                onClick={() => props.onResultPick(contestant.id)}
              >
                <span>{position >= 0 ? props.t(`${position + 1}位`, `#${position + 1}`) : "-"}</span>
                {contestant.icon} {contestant.name}
              </button>
            );
          })}
        </div>
        <button
          className={props.room.currentRace.status === "settled" ? "tertiary-button full" : "primary-button full"}
          type="button"
          onClick={props.onSettle}
          disabled={props.room.currentRace.status === "settled"}
        >
          {props.room.currentRace.status === "settled"
            ? props.t("払戻を反映済み", "Payouts applied")
            : props.t("この勝負の払戻を反映", "Apply this round's payouts")}
          <Check size={20} />
        </button>
        <p className="result-help">
          {props.room.currentRace.status === "settled"
            ? props.t("この勝負は確定済みです。続ける場合は次の勝負へ進んでください。", "This round is settled. Continue to the next round when ready.")
            : props.t("順位をすべて選んでから払戻を反映してください。ここではゲーム全体は終了しません。", "Choose every rank, then apply payouts. This does not end the whole game.")}
        </p>
        <button
          className={props.room.currentRace.status === "settled" ? "primary-button full next-round-button" : "secondary-button full next-round-button"}
          type="button"
          onClick={props.onNextRace}
          disabled={props.room.currentRace.status !== "settled"}
        >
          <ChevronRight size={18} />
          {props.currentRaceNumber >= props.room.settings.maxRaces
            ? props.t("最終結果を見る", "View final ranking")
            : props.t("次の勝負へ進む", "Start next round")}
        </button>
      </section>
    </div>
  );
}

function RankingView(props: {
  room: Room;
  ranking: Player[];
  displayMode: ResultDisplayMode;
  setDisplayMode: (value: ResultDisplayMode) => void;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  t: Translate;
}) {
  const latestHistory = props.room.raceHistory.at(-1);
  const historyContestants = latestHistory?.contestants?.length ? latestHistory.contestants : props.room.contestants;
  const betResultRows = latestHistory?.bets ?? [];
  const getHistoryContestant = (contestantId: string) =>
    historyContestants.find((contestant) => contestant.id === contestantId) ?? getContestant(props.room, contestantId);
  const formatBetPick = (bet: RaceBetResult) =>
    bet.contestantIds
      .map((contestantId, index) => {
        const contestant = getHistoryContestant(contestantId);
        return `${index + 1}.${contestant ? contestant.name : "Unknown"}`;
      })
      .join(" → ");
  const podiumPlayers = [
    props.ranking[1] ? { player: props.ranking[1], rank: 2 } : undefined,
    props.ranking[0] ? { player: props.ranking[0], rank: 1 } : undefined,
    props.ranking[2] ? { player: props.ranking[2], rank: 3 } : undefined,
  ].filter((item): item is { player: Player; rank: number } => Boolean(item));

  return (
    <div className="screen-stack">
      <section className="result-mode-panel">
        <SegmentedControl
          ariaLabel={props.t("結果表示切り替え", "Result view")}
          value={props.displayMode}
          onChange={props.setDisplayMode}
          options={[
            { value: "ranking", label: props.t("ランキング", "Ranking") },
            { value: "payouts", label: props.t("払戻表", "Payouts") },
          ]}
        />
      </section>

      {props.displayMode === "ranking" && (
        <section className="leader-preview full">
          <div className="section-heading">
            <Crown size={20} />
            <div>
              <h2>{props.t("リアルタイムランキング", "Live Ranking")}</h2>
              <p>{props.t("マイナス残高の人も最後まで表示します", "Negative balances stay visible until the end")}</p>
            </div>
          </div>
          {props.ranking.length === 0 ? (
            <div className="empty-state ranking-empty podium-empty-state">
              <Crown size={26} />
              <strong>{props.t("参加者待ちです", "Waiting for players")}</strong>
              <span>{props.t("参加者が入るとランキングがここに表示されます。", "The ranking appears here when players join.")}</span>
            </div>
          ) : (
            <div className="podium-grid">
              {podiumPlayers.map(({ player, rank }) => (
                <div className={`podium-card rank-${rank}`} key={player.id}>
                  <span className="podium-rank">{rank}</span>
                  <span className="avatar" style={{ "--accent": player.accent } as CSSProperties}>
                    {player.emoji}
                  </span>
                  <strong>{player.name}</strong>
                  <b>{currency.format(player.balance)}</b>
                </div>
              ))}
            </div>
          )}
          {props.ranking.map((player, index) => (
            <PlayerRankRow key={player.id} player={player} rank={index + 1} t={props.t} />
          ))}
        </section>
      )}

      {props.displayMode === "payouts" && (
        <section className="result-summary full">
          <div className="section-heading">
            <Medal size={20} />
            <div>
              <h2>{props.t("払戻表", "Payout Table")}</h2>
              <p>{latestHistory?.raceTitle ?? props.t("まだ確定したレースはありません", "No settled race yet")}</p>
            </div>
          </div>
          {latestHistory ? (
            <>
              <div className="result-order-strip">
                {latestHistory.resultIds.map((id, index) => {
                  const contestant = getHistoryContestant(id);
                  return (
                    <span key={id}>
                      <b>{index + 1}</b>
                      <strong>{contestant ? `${contestant.icon} ${contestant.name}` : "Unknown"}</strong>
                      <em>{contestant ? `${contestant.odds.toFixed(2)}x` : "-"}</em>
                    </span>
                  );
                })}
              </div>
              <div className="payout-table">
                <div className="payout-head">
                  <span>{props.t("参加者", "Bettor")}</span>
                  <span>{props.t("賭け", "Stake")}</span>
                  <span>{props.t("払戻", "Payout")}</span>
                  <span>±</span>
                </div>
                {latestHistory.payouts.map((payout) => {
                  const player = props.room.players.find((item) => item.id === payout.playerId);
                  return (
                    <div className={payout.delta >= 0 ? "payout-row plus" : "payout-row minus"} key={payout.playerId}>
                      <span className="payout-player">{player ? `${player.emoji} ${player.name}` : "Unknown"}</span>
                      <span>{currency.format(payout.stake)}</span>
                      <strong>{currency.format(payout.payout)}</strong>
                      <b>{payout.delta >= 0 ? "+" : ""}{currency.format(payout.delta)}</b>
                    </div>
                  );
                })}
              </div>
              <div className="bet-result-table">
                <div className="bet-result-title">
                  <strong>{props.t("投票結果", "Bet results")}</strong>
                  <span>{props.t("誰がどれに賭けて、どれが的中したか", "Who bet what and which tickets hit")}</span>
                </div>
                {betResultRows.length === 0 ? (
                  <p className="muted">{props.t("このレースの投票はありません。", "No bets in this race.")}</p>
                ) : (
                  <>
                    <div className="bet-result-head">
                      <span>{props.t("参加者", "Bettor")}</span>
                      <span>{props.t("買い目", "Pick")}</span>
                      <span>{props.t("倍率", "Odds")}</span>
                      <span>{props.t("結果", "Result")}</span>
                    </div>
                    {betResultRows.map((bet) => {
                      const player = props.room.players.find((item) => item.id === bet.playerId);
                      return (
                        <div className={bet.hit ? "bet-result-row hit" : "bet-result-row miss"} key={bet.id}>
                          <span className="bet-result-player">
                            {player ? `${player.emoji} ${player.name}` : "Unknown"}
                            <small>{bet.placedBy === "host" ? props.t("代行", "Proxy") : props.t("本人", "Self")}</small>
                          </span>
                          <strong>
                            {props.betTypeLabels[bet.type].title}
                            <small>{formatBetPick(bet)}</small>
                          </strong>
                          <span>{bet.multiplier.toFixed(2)}x</span>
                          <b>
                            {bet.hit ? props.t("的中", "Hit") : props.t("外れ", "Miss")}
                            <small>
                              {bet.delta >= 0 ? "+" : ""}
                              {currency.format(bet.delta)}
                            </small>
                          </b>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="race-ledger">
                <div className="race-ledger-head">
                  <span>{props.t("レース", "Race")}</span>
                  <span>{props.t("主な変動", "Top change")}</span>
                </div>
                {props.room.raceHistory.map((entry, index) => {
                  const topDelta = [...entry.payouts].sort((a, b) => b.delta - a.delta)[0];
                  const player = props.room.players.find((item) => item.id === topDelta?.playerId);
                  return (
                    <div className="race-ledger-row" key={entry.raceId}>
                      <span>{index + 1}</span>
                      <strong>
                        {player?.name ?? "-"} {topDelta ? `${topDelta.delta >= 0 ? "+" : ""}${currency.format(topDelta.delta)}` : ""}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="muted">{props.t("結果確定後に払戻とレース別の記録が表示されます。", "Payouts and race history appear after settling results.")}</p>
          )}
        </section>
      )}

      {props.displayMode === "ranking" && props.room.currentRace.status === "settled" && (
        <section className="result-summary">
          <div className="section-heading">
              <Medal size={20} />
              <div>
              <h2>{props.t("確定結果", "Final Results")}</h2>
              <p>{props.t("配当計算済み", "Payouts applied")}</p>
              </div>
            </div>
          {props.room.currentRace.resultIds.map((id, index) => {
            const contestant = getContestant(props.room, id);
            return (
              <div className="result-line" key={id}>
                <span>{index + 1}</span>
                <strong>{contestant ? `${contestant.icon} ${contestant.name}` : "Unknown"}</strong>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Metric(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {props.icon}
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function EmojiPicker(props: { value: string; onChange: (emoji: string) => void; label: string; compact?: boolean }) {
  const choices = props.compact ? emojiChoices.slice(0, 12) : emojiChoices;

  return (
    <div className={props.compact ? "emoji-picker compact" : "emoji-picker"} aria-label={props.label}>
      {choices.map((emoji) => (
        <button
          className={props.value === emoji ? "selected" : ""}
          key={emoji}
          type="button"
          onClick={() => props.onChange(emoji)}
          aria-label={`${props.label}: ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function PlayerRankRow(props: { player: Player; rank: number; compact?: boolean; t: Translate }) {
  const rankTone = props.rank <= 3 ? `rank-${props.rank}` : "rank-other";
  return (
    <div className={`rank-row ${rankTone} ${props.player.balance <= 0 ? "bankrupt" : ""}`}>
      <span className="rank-number">{props.rank}</span>
      <span className="avatar" style={{ "--accent": props.player.accent } as CSSProperties}>
        {props.player.emoji}
      </span>
      <strong>{props.player.name}</strong>
      {!props.compact && <span>{props.player.isOffline ? props.t("代行参加", "Proxy") : props.t("本人参加", "Self")}</span>}
      <span className="coin">
        <CircleDollarSign size={16} />
        {currency.format(props.player.balance)}
      </span>
    </div>
  );
}

function getPointerPosition(event: ReactPointerEvent<HTMLElement>, count: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
  return Math.max(0, Math.min(count - 1, ratio * count - 0.5));
}

function SegmentedControl<T extends string>(props: {
  ariaLabel: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const activeIndex = Math.max(0, props.options.findIndex((option) => option.value === props.value));
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const switchStyle = {
    "--toggle-count": props.options.length,
    "--toggle-position": dragPosition ?? activeIndex,
  } as CSSProperties;

  const moveToPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    const nextPosition = getPointerPosition(event, props.options.length);
    const nextIndex = Math.max(0, Math.min(props.options.length - 1, Math.round(nextPosition)));
    setDragPosition(nextPosition);
    if (props.options[nextIndex]?.value !== props.value) {
      props.onChange(props.options[nextIndex].value);
    }
  };
  const finishDrag = (event?: ReactPointerEvent<HTMLElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragPosition(null);
  };

  return (
    <section
      className={dragPosition === null ? "view-toggle" : "view-toggle dragging"}
      aria-label={props.ariaLabel}
      style={switchStyle}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveToPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) moveToPointer(event);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <span className="toggle-indicator" aria-hidden="true" />
      {props.options.map((option) => (
        <button
          className={props.value === option.value ? "selected" : ""}
          type="button"
          key={option.value}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </section>
  );
}

function BottomNav(props: { active: TabKey; role: "host" | "player"; onChange: (tab: TabKey) => void; t: Translate }) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; hostOnly?: boolean }> = [
    { key: "home", label: props.t("ホーム", "Home"), icon: <Home size={22} /> },
    { key: "bet", label: props.t("ベット", "Bet"), icon: <Zap size={22} /> },
    { key: "host", label: props.t("管理", "Host"), icon: <Settings2 size={22} />, hostOnly: true },
    { key: "ranking", label: props.t("順位", "Ranks"), icon: <Crown size={22} /> },
  ];
  const visibleTabs = tabs.filter((item) => props.role === "host" || !item.hostOnly);
  const activeIndex = Math.max(0, visibleTabs.findIndex((item) => item.key === props.active));
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const navStyle = {
    "--nav-count": visibleTabs.length,
    "--nav-position": dragPosition ?? activeIndex,
  } as CSSProperties;

  const moveToPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    const nextPosition = getPointerPosition(event, visibleTabs.length);
    const nextIndex = Math.max(0, Math.min(visibleTabs.length - 1, Math.round(nextPosition)));
    setDragPosition(nextPosition);
    const nextTab = visibleTabs[nextIndex];
    if (nextTab && nextTab.key !== props.active) {
      props.onChange(nextTab.key);
    }
  };
  const finishDrag = (event?: ReactPointerEvent<HTMLElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragPosition(null);
  };

  return (
    <nav
      className={dragPosition === null ? "bottom-nav" : "bottom-nav dragging"}
      aria-label={props.t("メインナビゲーション", "Main navigation")}
      style={navStyle}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveToPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) moveToPointer(event);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {visibleTabs.map((item) => (
        <button
          className={props.active === item.key ? "active" : ""}
          type="button"
          key={item.key}
          onClick={() => props.onChange(item.key)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default App;
