import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import {
  calculateAutoOdds,
  clampCount,
  clampRaceCount,
  clampRating,
  createBet,
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
import type { BetType, DraftBet, LanguageName, Player, Room, ThemeName } from "./lib/types";
import {
  RankBetView,
  RankBottomNav,
  RankCreateRoomView,
  RankHomeView,
  RankHostView,
  RankLaunchView,
  RankRankingView,
  RankRoomInviteView,
  RankRoomHeader,
} from "./RankPartyViews";
import type { RankHostSection, RoomCreateInput } from "./RankPartyViews";

type TabKey = "home" | "bet" | "host" | "ranking";
type Translate = (ja: string, en: string) => string;
type ResultDisplayMode = "ranking" | "payouts";
type LauncherMode = "launch" | "create" | "created" | "invite";

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

function buildJoinUrl(room: Room) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("roomId", room.id);
  url.searchParams.set("joinCode", room.joinCode);
  return url.toString();
}

function getBetTypeCopy(t: Translate): Record<BetType, { title: string; note: string }> {
  return {
    win: { title: t("単勝", "Win"), note: t("1位を当てる", "Pick 1st place") },
    place: { title: t("複勝", "Place"), note: t("3位以内を当てる", "Pick top 3") },
    exacta: { title: t("2連単", "Exacta"), note: t("1位・2位を順番通り", "Pick 1st and 2nd in order") },
    trifecta: { title: t("3連単", "Trifecta"), note: t("1位から3位まで順番通り", "Pick 1st to 3rd in order") },
  };
}

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
  const [launcherMode, setLauncherMode] = useState<LauncherMode>("launch");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [inviteShareReady, setInviteShareReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedContestantId, setSelectedContestantId] = useState(room.contestants[0]?.id ?? "");
  const [selectedPickIds, setSelectedPickIds] = useState<string[]>(room.contestants[0]?.id ? [room.contestants[0].id] : []);
  const [betType, setBetType] = useState<BetType>("win");
  const [amount, setAmount] = useState(100);
  const [resultDisplayMode, setResultDisplayMode] = useState<ResultDisplayMode>("ranking");
  const [hostSection, setHostSection] = useState<RankHostSection>("people");
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

  useEffect(() => {
    document.documentElement.dataset.theme = room.theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", room.theme === "neon" ? "#090b0e" : "#fbfbfc");
  }, [room.theme]);

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
  }, [showLauncher, launcherMode, tab, room.id, room.currentRace.id]);

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
  const isLaunchScreen = showLauncher || (session.role === "player" && !currentPlayer);
  const joinUrl = useMemo(() => buildJoinUrl(room), [room.id, room.joinCode]);
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

  async function handleCreateRoom(input: RoomCreateInput) {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    let hostUid: string | undefined;
    if (isFirebaseConfigured) {
      try {
        hostUid = await getFirebaseUid();
      } catch (error) {
        const message = getFirebaseIssueCopy(error, t);
        setSyncIssue(message);
        showToast(message);
        setIsCreatingRoom(false);
        return;
      }
    }
    try {
      const base = createBlankRoom(input.name.trim(), hostUid);
      const contestants = base.contestants.slice(0, input.maxContestants);
      const next: Room = {
        ...base,
        name: input.name.trim(),
        startingBalance: input.startingBalance,
        contestants: input.autoOdds ? calculateAutoOdds(contestants) : contestants,
        settings: {
          ...base.settings,
          maxRaces: input.maxRaces,
          maxPlayers: input.maxPlayers,
          maxContestants: input.maxContestants,
          autoOdds: input.autoOdds,
          marketOdds: input.marketOdds,
          allowDebt: input.allowDebt,
        },
        updatedAt: Date.now(),
      };

      commitRoom(next, false);
      let remoteReady = false;
      if (isFirebaseConfigured) {
        try {
          await saveFirebaseRoom(next);
          remoteReady = true;
          setSyncIssue("");
        } catch (error) {
          const message = getFirebaseIssueCopy(error, t);
          setSyncIssue(message);
          showToast(message);
        }
      }

      setSession((current) => ({ ...current, role: "host", playerId: undefined }));
      setTab("home");
      setProxyPlayerId("");
      setSelectedContestantId(next.contestants[0]?.id ?? "");
      setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
      setJoinRoomId(next.id);
      setJoinCode(next.joinCode);
      setInviteShareReady(remoteReady);
      setLauncherMode("created");
      setShowLauncher(true);
      if (remoteReady) {
        showToast(t("ルームを作成しました。QRで友達を招待できます。", "Room created. Invite friends with the QR code."));
      } else if (!isFirebaseConfigured) {
        showToast(t("端末内ルームを作成しました。QR参加にはFirebase設定が必要です。", "Local room created. Firebase is required for QR joining."));
      }
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleCopyInviteValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t(`${label}をコピーしました。`, `${label} copied.`));
    } catch {
      showToast(t("コピーできませんでした。長押ししてコピーしてください。", "Could not copy. Press and hold to copy."));
    }
  }

  async function handleShareInvite() {
    const shareText = t(
      `${room.name}に参加してください。ルームID: ${room.id} / 参加コード: ${room.joinCode}`,
      `Join ${room.name}. Room ID: ${room.id} / Join code: ${room.joinCode}`,
    );
    try {
      if (navigator.share) {
        await navigator.share({ title: room.name, text: shareText, url: joinUrl });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${joinUrl}`);
        showToast(t("招待リンクをコピーしました。", "Invitation link copied."));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast(t("共有できませんでした。", "Could not share the invitation."));
    }
  }

  function handleOpenHostRoom() {
    setLauncherMode("launch");
    setShowLauncher(false);
    setTab("home");
  }

  function handleOpenHostSection(section: RankHostSection) {
    setSession((current) => ({ ...current, role: "host", playerId: undefined }));
    setHostSection(section);
    setTab("host");
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
    setLauncherMode("launch");
    setShowLauncher(false);
    setTab("bet");
    showToast(t(`${name}で参加しました。`, `Joined as ${name}.`));
  }

  async function handleOpenRoom(roomId: string) {
    if (room.id === roomId) {
      setLauncherMode("launch");
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
      setInviteShareReady(true);
      setLauncherMode("launch");
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
    setResultDisplayMode("payouts");
    setTab("ranking");
    showToast(t("この勝負の払戻を反映しました。次の勝負へ進めます。", "Payouts applied for this round. You can start the next round."));
  }

  function handleNextRace() {
    const currentRaceNumber = Number(room.currentRace.title.match(/\d+/)?.[0] ?? room.raceHistory.length + 1);
    if (room.currentRace.status !== "settled") {
      showToast(t("先に順位を入力して、払戻を反映してください。", "Enter results and apply payouts first."));
      setHostSection("results");
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

  return (
    <main className="app-shell">
      <section className={isLaunchScreen ? "phone-frame launch-frame" : `phone-frame app-view app-view-${tab}`} aria-label="ランクパーティ">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />

        {isLaunchScreen ? (
          <>
            {launcherMode === "create" ? (
              <RankCreateRoomView
                t={t}
                isCreating={isCreatingRoom}
                onBack={() => setLauncherMode("launch")}
                onCreate={handleCreateRoom}
              />
            ) : launcherMode === "created" || launcherMode === "invite" ? (
              <RankRoomInviteView
                room={room}
                joinUrl={joinUrl}
                isNew={launcherMode === "created"}
                shareReady={inviteShareReady}
                syncIssue={syncIssue}
                t={t}
                onCopy={(value, label) => void handleCopyInviteValue(value, label)}
                onShare={() => void handleShareInvite()}
                onOpenHost={handleOpenHostRoom}
              />
            ) : (
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
                t={t}
                onCreateRoom={() => setLauncherMode("create")}
                onJoin={handleJoinPlayer}
                onOpenRoom={handleOpenRoom}
                onDeleteRoom={handleDeleteRoom}
              />
            )}

            {toast && (
              <div className="toast" role="status">
                {toast}
              </div>
            )}
          </>
        ) : (
          <>
        {tab !== "host" && !(tab === "ranking" && resultDisplayMode === "payouts") && (
          <RankRoomHeader
            tab={tab}
            room={room}
            activePlayer={activePlayer}
            t={t}
            onBack={() => {
              if (tab === "home" || session.role === "player") {
                setLauncherMode("launch");
                setShowLauncher(true);
              }
              else setTab("home");
            }}
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

          <>
            {tab === "home" && (
              <RankHomeView
                room={room}
                currentRaceNumber={currentRaceNumber}
                placedPlayerCount={placedPlayerCount}
                hasJackpot={hasJackpot}
                t={t}
                onBetTab={() => setTab("bet")}
                onOpenHostSection={handleOpenHostSection}
                onViewPayouts={() => {
                  setResultDisplayMode("payouts");
                  setTab("ranking");
                }}
                onNextRace={handleNextRace}
              />
            )}

            {tab === "bet" && (
              <RankBetView
                room={room}
                sessionRole={session.role}
                activePlayer={activePlayer}
                proxyPlayerId={proxyPlayerId}
                setProxyPlayerId={setProxyPlayerId}
                selectedPickIds={selectedPickIds}
                onPickContestant={handlePickContestant}
                betType={betType}
                setBetType={setBetType}
                amount={amount}
                setAmount={setAmount}
                potentialPayout={potentialPayout}
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
                section={hostSection}
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
                currentRaceNumber={currentRaceNumber}
                t={t}
                onAddPlayer={handleAddPlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddContestant={handleAddContestant}
                onDeleteContestant={handleDeleteContestant}
                onOddsChange={handleOddsChange}
                onThemeChange={handleThemeChange}
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
                onShowInvite={() => {
                  setInviteShareReady(isFirebaseConfigured && !syncIssue);
                  setLauncherMode("invite");
                  setShowLauncher(true);
                }}
                onBack={() => setTab("home")}
              />
            )}

            {tab === "ranking" && (
              <RankRankingView
                room={room}
                ranking={ranking}
                activePlayer={activePlayer}
                displayMode={resultDisplayMode}
                setDisplayMode={setResultDisplayMode}
                betTypeLabels={betTypeLabels}
                onNextRace={handleNextRace}
                t={t}
              />
            )}
          </>

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        {tab === "ranking" && resultDisplayMode === "ranking" && (
          <RankBottomNav
            active={tab}
            role={session.role}
            onChange={(nextTab) => nextTab === "host" ? handleOpenHostSection("people") : setTab(nextTab)}
            t={t}
          />
        )}
          </>
        )}
      </section>
    </main>
  );
}


export default App;
