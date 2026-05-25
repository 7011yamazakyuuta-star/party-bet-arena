import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gamepad2,
  Home,
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
  Wallet,
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
  isFirebaseConfigured,
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
import type { BetType, DraftBet, LanguageName, Player, Room, ThemeName } from "./lib/types";

type TabKey = "home" | "bet" | "host" | "ranking";
type Translate = (ja: string, en: string) => string;
type BetDisplayMode = "cards" | "board";
type ResultDisplayMode = "ranking" | "payouts";
type HostSection = "progress" | "settings" | "players" | "contestants";

const themeOrder: ThemeName[] = ["party", "garden", "candy", "sky", "neon", "pop", "minimal"];
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
    party: { label: t("パーティ", "Party"), note: t("やさしく明るい定番テーマ", "Bright and friendly default") },
    garden: { label: t("ガーデン", "Garden"), note: t("緑と白の落ち着いた遊び場", "Soft green and calm") },
    candy: { label: t("キャンディ", "Candy"), note: t("少しポップでにぎやか", "Playful and colorful") },
    sky: { label: t("スカイ", "Sky"), note: t("青空っぽく見やすい", "Clear and airy") },
    neon: { label: t("ネオン", "Neon"), note: t("暗めでゲーミング感", "Dark gaming glow") },
    pop: { label: t("ポップ", "Pop"), note: t("濃いめのイベント感", "Vivid event mood") },
    minimal: { label: t("ミニマル", "Minimal"), note: t("控えめで読みやすい", "Quiet and readable") },
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

function formatTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedContestantId, setSelectedContestantId] = useState(room.contestants[0]?.id ?? "");
  const [selectedPickIds, setSelectedPickIds] = useState<string[]>(room.contestants[0]?.id ? [room.contestants[0].id] : []);
  const [betType, setBetType] = useState<BetType>("win");
  const [amount, setAmount] = useState(100);
  const [betDisplayMode, setBetDisplayMode] = useState<BetDisplayMode>("board");
  const [resultDisplayMode, setResultDisplayMode] = useState<ResultDisplayMode>("ranking");
  const [proxyPlayerId, setProxyPlayerId] = useState(room.players[0]?.id ?? "");
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState(room.id);
  const [joinCode, setJoinCode] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerOffline, setNewPlayerOffline] = useState(true);
  const [newPlayerEmoji, setNewPlayerEmoji] = useState("🎮");
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantOdds, setNewContestantOdds] = useState(2.5);
  const [newContestantStrength, setNewContestantStrength] = useState(7);
  const [newContestantCpuLevel, setNewContestantCpuLevel] = useState(7);
  const [newContestantIsCpu, setNewContestantIsCpu] = useState(true);
  const [newContestantEmoji, setNewContestantEmoji] = useState("🤖");
  const [bonusPlayerId, setBonusPlayerId] = useState(room.players[0]?.id ?? "");
  const [bonusAmount, setBonusAmount] = useState(room.settings.specialBonus);
  const [resultIds, setResultIds] = useState<string[]>(room.currentRace.resultIds);
  const [toast, setToast] = useState("");
  const [syncIssue, setSyncIssue] = useState("");
  const [tick, setTick] = useState(Date.now());
  const language = session.language ?? "ja";
  const t: Translate = (ja, en) => translateText(language, ja, en);
  const betTypeLabels = useMemo(() => getBetTypeCopy(t), [language]);
  const themeCopy = useMemo(() => getThemeCopy(t), [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = room.theme;
  }, [room.theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
    if (session.role !== "host" || !room.players.length) return;
    if (!room.players.some((player) => player.id === proxyPlayerId)) {
      setProxyPlayerId(room.players[0].id);
    }
  }, [proxyPlayerId, room.players, session.role]);

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
  const draftBet: DraftBet = {
    playerId: activePlayerId,
    contestantId: selectedContestantId,
    contestantIds: selectedPickIds,
    type: betType,
    amount,
    placedBy: session.role === "host" ? "host" : "self",
  };
  const potentialPayout = getPotentialPayout(room, draftBet);
  const elapsedTime = formatTime(tick - room.currentRace.startedAt);
  const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
  const displayRoomName = room.name.trim() || t("名前を入力中", "Editing name");
  const publicUrl = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
  const hasJackpot = room.currentRace.status === "settled" && room.currentRace.bets.some((bet) => {
    const contestant = getContestant(room, getBetPickIds(bet)[0]);
    return contestant && contestant.odds >= 4 && isBetHit(bet.type, getBetPickIds(bet), room.currentRace.resultIds);
  });

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

  function handleCreateRoom() {
    const next = createBlankRoom(t("新しい勝負", "New Match"));
    commitRoom(next);
    setSession((current) => ({ ...current, role: "host", playerId: undefined }));
    setProxyPlayerId(next.players[0]?.id ?? "");
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
    let targetRoom = room;

    if (normalizedRoomId !== room.id) {
      const remoteRoom = await fetchFirebaseRoom(normalizedRoomId);
      if (!remoteRoom) {
        showToast(t("ルームが見つかりません。ルームIDを確認してください。", "Room not found. Please check the room ID."));
        return;
      }
      targetRoom = remoteRoom;
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
    commitRoom(next);
    setSession((current) => ({ ...current, role: "player", playerId: player.id }));
    setTab("bet");
    showToast(t(`${name}で参加しました。`, `Joined as ${name}.`));
  }

  async function handleOpenRoom(roomId: string) {
    if (room.id === roomId) {
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
      commitRoom(remoteRoom);
      setSession((current) => ({ ...current, role: "host", playerId: undefined }));
      setProxyPlayerId(remoteRoom.players[0]?.id ?? "");
      setBonusPlayerId(remoteRoom.players[0]?.id ?? "");
      setSelectedContestantId(remoteRoom.contestants[0]?.id ?? "");
      setSelectedPickIds(remoteRoom.contestants[0]?.id ? [remoteRoom.contestants[0].id] : []);
      setResultIds(remoteRoom.currentRace.resultIds ?? []);
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
      setProxyPlayerId(next.players[0]?.id ?? "");
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
    const text = `Party Bet Arena\nURL: ${publicUrl}\n${t("ルームID", "Room ID")}: ${room.id}\n${t("参加コード", "Join code")}: ${room.joinCode}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("招待情報をコピーしました。", "Invite copied."));
    } catch {
      showToast(t("コピーできませんでした。URLとルームIDを手動で共有してください。", "Could not copy. Please share the URL and room ID manually."));
    }
  }

  function handlePlaceBet() {
    const error = validateBet(room, draftBet);
    if (error) {
      showToast(translateBetError(error, t));
      return;
    }

    const next = {
      ...room,
      currentRace: {
        ...room.currentRace,
        bets: [...room.currentRace.bets, createBet(draftBet)],
      },
      updatedAt: Date.now(),
    };

    commitRoom(next);
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
              strengthRating: clampRating(newContestantStrength),
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
              strengthRating: clampRating(newContestantStrength),
              cpuLevel: clampRating(newContestantCpuLevel),
              isCpu: newContestantIsCpu,
            },
          ],
      updatedAt: Date.now(),
    }));
    setNewContestantName("");
    setNewContestantOdds(2.5);
    setNewContestantStrength(7);
    setNewContestantCpuLevel(7);
    setNewContestantEmoji(emojiChoices[(room.contestants.length + 3) % emojiChoices.length]);
    showToast(t("勝負するプレイヤーを追加しました。", "Contestant added."));
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

  function handleContestantStrengthChange(
    contestantId: string,
    patch: Partial<{ strengthRating: number; cpuLevel: number; isCpu: boolean; icon: string }>,
  ) {
    updateRoom((current) => {
      const contestants = current.contestants.map((contestant) =>
        contestant.id === contestantId
          ? {
              ...contestant,
              ...patch,
              strengthRating: clampRating(patch.strengthRating ?? contestant.strengthRating),
              cpuLevel: clampRating(patch.cpuLevel ?? contestant.cpuLevel),
            }
          : contestant,
      );

      const shouldRecalculateOdds =
        "strengthRating" in patch || "cpuLevel" in patch || "isCpu" in patch;

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
    setTab("home");
    setProxyPlayerId(next.players[0]?.id ?? "");
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    showToast(t("デモ状態をリセットしました。", "Demo reset."));
  }

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="Party Bet Arena">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />

        <header className="topbar">
          <div>
            <p className="eyebrow">Party Bet Arena</p>
            <h1>{displayRoomName}</h1>
          </div>
          <div className="top-actions">
            <button className="pill-button" type="button" onClick={handleHostMode}>
              <Crown size={18} />
              {t("幹事", "Host")}
            </button>
            <select
              className="language-select"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value as LanguageName)}
              aria-label={t("言語を選択", "Choose language")}
            >
              {languageOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.short} {option.label}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              type="button"
              aria-label={t("ゲストモード", "Guest mode")}
              onClick={() => setSession((current) => ({ ...current, role: "player", playerId: currentPlayer?.id }))}
            >
              <Users size={20} />
            </button>
          </div>
        </header>

        <section className="status-strip">
          <div>
            <span>{t("ルーム", "Room")}</span>
            <strong>{room.id}</strong>
          </div>
          <div>
            <span>{t("コード", "Code")}</span>
            <strong>{room.joinCode}</strong>
          </div>
          <div>
            <span>{room.isDemo ? t("表示", "Mode") : isFirebaseConfigured ? t("同期", "Sync") : t("保存先", "Storage")}</span>
            <strong className={isFirebaseConfigured ? "online" : ""}>
              {room.isDemo ? t("デモ", "Demo") : isFirebaseConfigured ? "Firebase" : t("端末内", "Local")}
            </strong>
          </div>
        </section>

        {syncIssue && !room.isDemo && (
          <section className="sync-alert" role="status">
            <Radio size={18} />
            <p>{syncIssue}</p>
            <button type="button" onClick={() => setSyncIssue("")}>
              {t("閉じる", "Close")}
            </button>
          </section>
        )}

        {session.role === "player" && !currentPlayer ? (
          <JoinPanel
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
              <HomeView
                room={room}
                ranking={ranking}
                elapsedTime={elapsedTime}
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
              <BetView
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
                elapsedTime={elapsedTime}
                currentRaceNumber={currentRaceNumber}
                onPickOrder={handlePickOrder}
                onPlaceBet={handlePlaceBet}
                betTypeLabels={betTypeLabels}
                t={t}
              />
            )}

            {tab === "host" && (
              <HostView
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
                newContestantStrength={newContestantStrength}
                setNewContestantStrength={setNewContestantStrength}
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
                betTypeLabels={betTypeLabels}
                elapsedTime={elapsedTime}
                currentRaceNumber={currentRaceNumber}
                t={t}
                onAddPlayer={handleAddPlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddContestant={handleAddContestant}
                onOddsChange={handleOddsChange}
                onThemeChange={handleThemeChange}
                onRoomNameChange={handleRoomNameChange}
                onStartingBalanceChange={handleStartingBalanceChange}
                onPlayerEmojiChange={handlePlayerEmojiChange}
                onContestantStrengthChange={handleContestantStrengthChange}
                onSettingChange={handleSettingChange}
                onAutoOdds={handleAutoOdds}
                onGrantBonus={handleGrantBonus}
                onResultPick={handleResultPick}
                onSettle={handleSettle}
                onNextRace={handleNextRace}
              />
            )}

            {tab === "ranking" && (
              <RankingView
                room={room}
                ranking={ranking}
                displayMode={resultDisplayMode}
                setDisplayMode={setResultDisplayMode}
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

        <BottomNav active={tab} role={session.role} onChange={setTab} t={t} />
      </section>
    </main>
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
        {props.t("幹事から届いた招待文のURL、ルームID、参加コードを使います。DEMO42は練習用です。", "Use the URL, room ID, and join code from the host. DEMO42 is only for practice.")}
      </p>
    </section>
  );
}

function HomeView(props: {
  room: Room;
  ranking: Player[];
  elapsedTime: string;
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
      <section className="race-hero">
        <div>
          <p className="badge">{props.room.isDemo ? props.t("デモ表示", "Demo") : props.t("開催中", "Live")}</p>
          <h2>{props.t(`第${props.currentRaceNumber}レース`, `Race ${props.currentRaceNumber}`)}</h2>
          <p>
            {props.room.isDemo
              ? props.t("この名前と数値は操作確認用のサンプルです", "Names and numbers here are sample data")
              : props.t("友だちのスマホから同じルームに参加できます", "Friends can join this room from their phones")}
          </p>
        </div>
        <div className="timer">
          <Radio size={18} />
          <span>{props.t(`第${props.currentRaceNumber}/${props.room.settings.maxRaces}レース`, `Race ${props.currentRaceNumber}/${props.room.settings.maxRaces}`)}</span>
          <small>{props.t(`経過 ${props.elapsedTime}`, `Elapsed ${props.elapsedTime}`)}</small>
        </div>
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
                  <button type="button" onClick={() => props.onOpenRoom(summary.id)} disabled={isCurrent}>
                    {isCurrent ? props.t("表示中", "Showing") : props.t("開く", "Open")}
                  </button>
                  <button className="delete-room-button" type="button" onClick={() => props.onDeleteRoom(summary.id)}>
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
          {props.room.isDemo ? props.t("本番ルーム", "Live room") : props.t("新規ルーム", "New room")}
        </button>
        <button className="secondary-button icon-only" type="button" aria-label={props.t("デモリセット", "Reset demo")} onClick={props.onResetDemo}>
          <RotateCcw size={18} />
        </button>
      </section>
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
  elapsedTime: string;
  currentRaceNumber: number;
  onPickOrder: (contestantIds: string[]) => void;
  onPlaceBet: () => void;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  t: Translate;
}) {
  const available = props.activePlayer ? getAvailableBalance(props.room, props.activePlayer.id) : 0;
  const shownBalance = props.room.settings.allowDebt ? props.activePlayer?.balance ?? 0 : available;
  const pickCount = requiredPickCount(props.betType);
  const selectedContestants = props.selectedPickIds
    .map((contestantId) => getContestant(props.room, contestantId))
    .filter((contestant): contestant is NonNullable<ReturnType<typeof getContestant>> => Boolean(contestant));
  const statusLabel = props.room.currentRace.status === "settled"
    ? props.t("確定済み", "Settled")
    : props.room.currentRace.status === "closed"
      ? props.t("受付終了", "Closed")
      : props.t("受付中", "Open");

  return (
    <div className="screen-stack">
      <section className="race-mini">
        <div>
          <span>{props.t("現在の勝負", "Current round")}</span>
          <strong>{props.t(`第${props.currentRaceNumber}/${props.room.settings.maxRaces}レース`, `Race ${props.currentRaceNumber}/${props.room.settings.maxRaces}`)}</strong>
        </div>
        <div>
          <span>{props.t("状態", "Status")}</span>
          <strong>{statusLabel}</strong>
        </div>
        <div>
          <span>{props.t("経過", "Elapsed")}</span>
          <strong>{props.elapsedTime}</strong>
        </div>
      </section>

      {props.sessionRole === "host" && (
        <section className="proxy-strip">
          <div className="section-heading">
            <UserPlus size={20} />
            <div>
              <h2>{props.t("幹事代行入力", "Host Proxy Bet")}</h2>
              <p>{props.t("スマホを使わない参加者のベットを代理受付", "Place bets for players without their own phone")}</p>
            </div>
          </div>
          <select value={props.proxyPlayerId} onChange={(event) => props.setProxyPlayerId(event.target.value)}>
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

      <section className="view-toggle" aria-label={props.t("表示切り替え", "View mode")}>
        <button
          className={props.displayMode === "board" ? "selected" : ""}
          type="button"
          onClick={() => props.setDisplayMode("board")}
        >
          {props.t("馬券表", "Ticket board")}
        </button>
        <button
          className={props.displayMode === "cards" ? "selected" : ""}
          type="button"
          onClick={() => props.setDisplayMode("cards")}
        >
          {props.t("カード", "Cards")}
        </button>
      </section>

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

      <section className="payout-preview">
        <div>
          <Sparkles size={24} />
          <span>{props.t("的中時の獲得見込み", "Estimated win")}</span>
        </div>
        <strong>{currency.format(props.potentialPayout)} {props.t("コイン", "coins")}</strong>
      </section>

      <button className="primary-button sticky-action" type="button" onClick={props.onPlaceBet}>
        {props.t("ベットする", "Place Bet")}
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
  newContestantStrength: number;
  setNewContestantStrength: (value: number) => void;
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
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  elapsedTime: string;
  currentRaceNumber: number;
  t: Translate;
  onAddPlayer: () => void;
  onDeletePlayer: (playerId: string) => void;
  onAddContestant: () => void;
  onOddsChange: (contestantId: string, odds: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onRoomNameChange: (name: string) => void;
  onStartingBalanceChange: (value: number) => void;
  onPlayerEmojiChange: (playerId: string, emoji: string) => void;
  onContestantStrengthChange: (
    contestantId: string,
    patch: Partial<{ strengthRating: number; cpuLevel: number; isCpu: boolean; icon: string }>,
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
  const hostTabs: Array<{ key: HostSection; label: string; note: string; icon: ReactNode }> = [
    { key: "progress", label: props.t("進行", "Run"), note: props.t("結果入力とベット確認", "Results and bets"), icon: <Trophy size={18} /> },
    { key: "settings", label: props.t("基本", "Setup"), note: props.t("勝負名・ルール", "Name and rules"), icon: <Lock size={18} /> },
    { key: "players", label: props.t("参加者", "Bettors"), note: props.t("代行・ボーナス", "Proxy and bonus"), icon: <Users size={18} /> },
    { key: "contestants", label: props.t("対戦者", "Racers"), note: props.t("CPU・倍率", "CPU and odds"), icon: <Gamepad2 size={18} /> },
  ];
  const hostSectionClass = (section: HostSection) => `host-panel ${hostSection === section ? "" : "host-hidden"}`;

  return (
    <div className="screen-stack host-stack">
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

      <section className={hostSectionClass("progress")}>
        <div className="section-heading">
          <Radio size={20} />
          <div>
            <h2>{props.t("現在の進行", "Current Flow")}</h2>
            <p>{props.t("ベット画面にも同じレース番号を表示します。", "The bet screen shows the same race number.")}</p>
          </div>
        </div>
        <div className="race-mini host-race-mini">
          <div>
            <span>{props.t("レース", "Race")}</span>
            <strong>{props.t(`第${props.currentRaceNumber}/${props.room.settings.maxRaces}レース`, `Race ${props.currentRaceNumber}/${props.room.settings.maxRaces}`)}</strong>
          </div>
          <div>
            <span>{props.t("受付済み", "Bets")}</span>
            <strong>{props.room.currentRace.bets.length}</strong>
          </div>
          <div>
            <span>{props.t("経過", "Elapsed")}</span>
            <strong>{props.elapsedTime}</strong>
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
          {props.t("強さ/CPU Lvから倍率更新", "Update odds from strength / CPU Lv")}
        </button>
        <p className="host-note">
          {props.t(
            "自動オッズは強さから初期勝率を作り、BET量変動をONにすると人気の馬券ほど倍率が下がります。",
            "Auto odds estimate base win rates from power. Pool odds lower the multiplier for popular tickets.",
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
            <p>{props.t("強さに合わせて自動、または倍率を手動調整", "Auto-adjust by power or edit odds manually")}</p>
          </div>
        </div>
        <p className="host-note compact-note">
          {props.t(
            `現在 ${props.room.contestants.length}/${props.room.settings.maxContestants}人。名前を空欄で追加するとCPU名を自動で作ります。`,
            `${props.room.contestants.length}/${props.room.settings.maxContestants} racers. Leave the name blank to auto-create a CPU name.`,
          )}
        </p>
        <div className="inline-form">
          <input
            value={props.newContestantName}
            onChange={(event) => props.setNewContestantName(event.target.value)}
            placeholder={props.t("対戦者名（空欄でCPU自動）", "Racer name (blank for CPU)")}
          />
          <input
            className="small-input"
            type="number"
            min="1"
            max="9"
            value={props.newContestantCpuLevel}
            onChange={(event) => props.setNewContestantCpuLevel(Number(event.target.value))}
            aria-label={props.t("CPUレベル", "CPU level")}
          />
          <input
            className="odds-input"
            type="number"
            min="1.01"
            step="0.1"
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
          <button type="button" onClick={props.onAddContestant} aria-label={props.t("対戦者を追加", "Add contestant")}>
            <Plus size={18} />
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
                onChange={(event) => props.onContestantStrengthChange(contestant.id, { isCpu: event.target.checked })}
              />
              {props.t("CPU", "CPU")}
            </label>
            <label>
              {props.t("強さ", "Power")}
              <input
                type="number"
                min="1"
                max="9"
                value={contestant.strengthRating}
                onChange={(event) =>
                  props.onContestantStrengthChange(contestant.id, { strengthRating: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Lv
              <input
                type="number"
                min="1"
                max="9"
                value={contestant.cpuLevel}
                onChange={(event) =>
                  props.onContestantStrengthChange(contestant.id, { cpuLevel: Number(event.target.value) })
                }
              />
            </label>
            <input
              type="number"
              min="1.01"
              step="0.1"
              value={contestant.odds}
              onChange={(event) => props.onOddsChange(contestant.id, Number(event.target.value))}
            />
            <EmojiPicker
              value={contestant.icon}
              onChange={(emoji) => props.onContestantStrengthChange(contestant.id, { icon: emoji })}
              label={props.t(`${contestant.name}のアイコン`, `${contestant.name}'s icon`)}
              compact
            />
          </div>
        ))}
      </section>

      <section className={hostSectionClass("progress")}>
        <div className="section-heading">
          <BarChart3 size={20} />
          <div>
            <h2>{props.t("ベット状況", "Bet Status")}</h2>
            <p>{props.t(`${props.room.currentRace.bets.length}件のベットを受付済み`, `${props.room.currentRace.bets.length} bets placed`)}</p>
          </div>
        </div>
        <div className="bet-log-window">
          {props.room.currentRace.bets.length === 0 ? (
            <p className="muted">{props.t("まだベットはありません。", "No bets yet.")}</p>
          ) : (
            <>
              <div className="bet-log-head">
                <span>{props.t("参加者", "Bettor")}</span>
                <span>{props.t("対象", "Pick")}</span>
                <span>{props.t("式", "Type")}</span>
                <span>{props.t("額", "Amount")}</span>
                <span>{props.t("入力", "By")}</span>
              </div>
              <div className="bet-log">
                {[...props.room.currentRace.bets].reverse().map((bet) => {
                  const player = props.room.players.find((item) => item.id === bet.playerId);
                  const betTarget = getBetPickIds(bet)
                    .map((contestantId) => props.room.contestants.find((item) => item.id === contestantId)?.name)
                    .filter(Boolean)
                    .join(" → ");
                  return (
                    <div className="bet-log-row" key={bet.id}>
                      <span>{player?.name ?? "Unknown"}</span>
                      <strong>{betTarget || "Unknown"}</strong>
                      <span>{props.betTypeLabels[bet.type].title}</span>
                      <strong>{currency.format(bet.amount)}</strong>
                      <em>{bet.placedBy === "host" ? props.t("代行", "Proxy") : props.t("本人", "Self")}</em>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section className={hostSectionClass("progress")}>
        <div className="section-heading">
          <Trophy size={20} />
          <div>
            <h2>{props.t("結果入力", "Enter Results")}</h2>
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
        <button className="primary-button" type="button" onClick={props.onSettle} disabled={props.room.currentRace.status === "settled"}>
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
          className="secondary-button full next-round-button"
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
  t: Translate;
}) {
  const latestHistory = props.room.raceHistory.at(-1);
  const podiumPlayers = [
    props.ranking[1] ? { player: props.ranking[1], rank: 2 } : undefined,
    props.ranking[0] ? { player: props.ranking[0], rank: 1 } : undefined,
    props.ranking[2] ? { player: props.ranking[2], rank: 3 } : undefined,
  ].filter((item): item is { player: Player; rank: number } => Boolean(item));

  return (
    <div className="screen-stack">
      <section className="result-mode-panel">
        <div className="view-toggle" aria-label={props.t("結果表示切り替え", "Result view")}>
          <button
            className={props.displayMode === "ranking" ? "selected" : ""}
            type="button"
            onClick={() => props.setDisplayMode("ranking")}
          >
            {props.t("ランキング", "Ranking")}
          </button>
          <button
            className={props.displayMode === "payouts" ? "selected" : ""}
            type="button"
            onClick={() => props.setDisplayMode("payouts")}
          >
            {props.t("払戻表", "Payouts")}
          </button>
        </div>
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
                  const contestant = getContestant(props.room, id);
                  return (
                    <span key={id}>
                      <b>{index + 1}</b>
                      {contestant ? `${contestant.icon} ${contestant.name}` : "Unknown"}
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

function BottomNav(props: { active: TabKey; role: "host" | "player"; onChange: (tab: TabKey) => void; t: Translate }) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; hostOnly?: boolean }> = [
    { key: "home", label: props.t("ホーム", "Home"), icon: <Home size={22} /> },
    { key: "bet", label: props.t("ベット", "Bet"), icon: <Zap size={22} /> },
    { key: "host", label: props.t("管理", "Host"), icon: <Settings2 size={22} />, hostOnly: true },
    { key: "ranking", label: props.t("順位", "Ranks"), icon: <Wallet size={22} /> },
  ];

  return (
    <nav className="bottom-nav" aria-label={props.t("メインナビゲーション", "Main navigation")}>
      {tabs
        .filter((item) => props.role === "host" || !item.hostOnly)
        .map((item) => (
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
