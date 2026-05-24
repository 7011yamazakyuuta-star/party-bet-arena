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
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  calculateAutoOdds,
  clampCount,
  clampRating,
  createBet,
  currency,
  getAvailableBalance,
  getBetPickIds,
  getContestant,
  getPotentialPayout,
  isBetHit,
  placeMultiplier,
  rankedPlayers,
  requiredPickCount,
  settleRoom,
  startNextRace,
  validateBet,
} from "./lib/calculations";
import { createBlankRoom } from "./lib/sample";
import { fetchFirebaseRoom, isFirebaseConfigured, saveFirebaseRoom, subscribeFirebaseRoom } from "./lib/firebase";
import { loadRoom, loadSession, resetLocalRoom, saveRoom, saveSession } from "./lib/storage";
import type { BetType, DraftBet, LanguageName, Player, Room, ThemeName } from "./lib/types";

type TabKey = "home" | "bet" | "host" | "ranking";
type Translate = (ja: string, en: string) => string;

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

const quickAmounts = [10, 50, 100, 250, 500];

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

function App() {
  const [room, setRoom] = useState(loadRoom);
  const [session, setSession] = useState(loadSession);
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedContestantId, setSelectedContestantId] = useState(room.contestants[0]?.id ?? "");
  const [selectedPickIds, setSelectedPickIds] = useState<string[]>(room.contestants[0]?.id ? [room.contestants[0].id] : []);
  const [betType, setBetType] = useState<BetType>("win");
  const [amount, setAmount] = useState(100);
  const [proxyPlayerId, setProxyPlayerId] = useState(room.players[0]?.id ?? "");
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState(room.id);
  const [joinCode, setJoinCode] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerOffline, setNewPlayerOffline] = useState(true);
  const [newPlayerSkill, setNewPlayerSkill] = useState(5);
  const [newPlayerEmoji, setNewPlayerEmoji] = useState("🎮");
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantOdds, setNewContestantOdds] = useState(2.5);
  const [newContestantStrength, setNewContestantStrength] = useState(7);
  const [newContestantCpuLevel, setNewContestantCpuLevel] = useState(7);
  const [newContestantIsCpu, setNewContestantIsCpu] = useState(true);
  const [newContestantEmoji, setNewContestantEmoji] = useState("🤖");
  const [resultIds, setResultIds] = useState<string[]>(room.currentRace.resultIds);
  const [toast, setToast] = useState("");
  const [tick, setTick] = useState(Date.now());
  const language = session.language ?? "ja";
  const t: Translate = (ja, en) => (language === "ja" ? ja : en);
  const betTypeLabels = useMemo(() => getBetTypeCopy(t), [language]);
  const themeCopy = useMemo(() => getThemeCopy(t), [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = room.theme;
  }, [room.theme]);

  useEffect(() => {
    document.documentElement.lang = language === "ja" ? "ja" : "en";
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
    if (!isFirebaseConfigured || room.isDemo) return;

    let unsubscribe: undefined | (() => void);
    subscribeFirebaseRoom(room.id, (remoteRoom) => {
      setRoom(remoteRoom);
      saveRoom(remoteRoom);
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
  const timeLeft = formatTime(room.currentRace.endsAt - tick);
  const publicUrl = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
  const hasJackpot = room.currentRace.status === "settled" && room.currentRace.bets.some((bet) => {
    const contestant = getContestant(room, getBetPickIds(bet)[0]);
    return contestant && contestant.odds >= 4 && isBetHit(bet.type, getBetPickIds(bet), room.currentRace.resultIds);
  });

  function commitRoom(nextRoom: Room, sync = true) {
    setRoom(nextRoom);
    saveRoom(nextRoom);
    if (sync && isFirebaseConfigured && !nextRoom.isDemo) {
      saveFirebaseRoom(nextRoom).catch(() => {
        setToast(t("Firebase保存に失敗しました。端末内の状態は残っています。", "Firebase save failed. Local state is still kept."));
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
      skillRating: 5,
      emoji: emojiChoices[targetRoom.players.length % emojiChoices.length],
    };

    const next = {
      ...targetRoom,
      players: [...targetRoom.players, player],
      updatedAt: Date.now(),
    };
    commitRoom(next);
    setSession((current) => ({ ...current, role: "player", playerId: player.id }));
    setTab("bet");
    showToast(t(`${name}で参加しました。`, `Joined as ${name}.`));
  }

  function handleRoomNameChange(name: string) {
    updateRoom((current) => ({ ...current, name: name || t("新しい勝負", "New Match"), updatedAt: Date.now() }));
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
          skillRating: clampRating(newPlayerSkill),
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

  function handleAddContestant() {
    const name = newContestantName.trim();
    if (!name) return;
    if (room.contestants.length >= room.settings.maxContestants) {
      showToast(t(`勝負するプレイヤーは最大${room.settings.maxContestants}人までです。`, `Up to ${room.settings.maxContestants} contestants can play.`));
      return;
    }

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

      return {
        ...current,
        contestants: current.settings.autoOdds ? calculateAutoOdds(contestants) : contestants,
        updatedAt: Date.now(),
      };
    });
  }

  function handlePlayerSkillChange(playerId: string, skillRating: number) {
    updateRoom((current) => ({
      ...current,
      players: current.players.map((player) =>
        player.id === playerId ? { ...player, skillRating: clampRating(skillRating) } : player,
      ),
      updatedAt: Date.now(),
    }));
  }

  function handlePlayerEmojiChange(playerId: string, emoji: string) {
    updateRoom((current) => ({
      ...current,
      players: current.players.map((player) => (player.id === playerId ? { ...player, emoji } : player)),
      updatedAt: Date.now(),
    }));
  }

  function handleSettingChange(key: "maxPlayers" | "maxContestants" | "autoOdds", value: number | boolean) {
    updateRoom((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: typeof value === "number" ? clampCount(value) : value,
      },
      updatedAt: Date.now(),
    }));
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
    setTab("ranking");
    showToast(t("結果を確定して配当を反映しました。", "Results settled and payouts applied."));
  }

  function handleNextRace() {
    const next = startNextRace(room);
    commitRoom(next);
    setResultIds([]);
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
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
            <h1>{room.name}</h1>
          </div>
          <div className="top-actions">
            <button className="pill-button" type="button" onClick={handleHostMode}>
              <Crown size={18} />
              {t("幹事", "Host")}
            </button>
            <button
              className="pill-button language-button"
              type="button"
              onClick={() => handleLanguageChange(language === "ja" ? "en" : "ja")}
              aria-label={t("言語を切り替え", "Switch language")}
            >
              {language === "ja" ? "JP" : "EN"}
            </button>
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
                timeLeft={timeLeft}
                hasJackpot={hasJackpot}
                publicUrl={publicUrl}
                t={t}
                onCreateRoom={handleCreateRoom}
                onBetTab={() => setTab("bet")}
                onHostTab={handleHostMode}
                onJoinMode={handleJoinMode}
                onResetDemo={handleResetDemo}
                onCopyInvite={handleCopyInvite}
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
                newPlayerSkill={newPlayerSkill}
                setNewPlayerSkill={setNewPlayerSkill}
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
                resultIds={resultIds}
                themeCopy={themeCopy}
                betTypeLabels={betTypeLabels}
                t={t}
                onAddPlayer={handleAddPlayer}
                onAddContestant={handleAddContestant}
                onOddsChange={handleOddsChange}
                onThemeChange={handleThemeChange}
                onRoomNameChange={handleRoomNameChange}
                onPlayerSkillChange={handlePlayerSkillChange}
                onPlayerEmojiChange={handlePlayerEmojiChange}
                onContestantStrengthChange={handleContestantStrengthChange}
                onSettingChange={handleSettingChange}
                onAutoOdds={handleAutoOdds}
                onResultPick={handleResultPick}
                onSettle={handleSettle}
                onNextRace={handleNextRace}
              />
            )}

            {tab === "ranking" && <RankingView room={room} ranking={ranking} t={t} />}
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
  timeLeft: string;
  hasJackpot: boolean;
  publicUrl: string;
  t: Translate;
  onCreateRoom: () => void;
  onBetTab: () => void;
  onHostTab: () => void;
  onJoinMode: () => void;
  onResetDemo: () => void;
  onCopyInvite: () => void;
}) {
  const betCount = props.room.currentRace.bets.length;

  return (
    <div className="screen-stack">
      <section className="race-hero">
        <div>
          <p className="badge">{props.room.isDemo ? props.t("デモ表示", "Demo") : props.t("開催中", "Live")}</p>
          <h2>{props.room.currentRace.title}</h2>
          <p>
            {props.room.isDemo
              ? props.t("この名前と数値は操作確認用のサンプルです", "Names and numbers here are sample data")
              : props.t("友だちのスマホから同じルームに参加できます", "Friends can join this room from their phones")}
          </p>
        </div>
        <div className="timer">
          <Radio size={18} />
          {props.timeLeft}
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
  onPlaceBet: () => void;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  t: Translate;
}) {
  const available = props.activePlayer ? getAvailableBalance(props.room, props.activePlayer.id) : 0;
  const pickCount = requiredPickCount(props.betType);
  const selectedContestants = props.selectedPickIds
    .map((contestantId) => getContestant(props.room, contestantId))
    .filter((contestant): contestant is NonNullable<ReturnType<typeof getContestant>> => Boolean(contestant));

  return (
    <div className="screen-stack">
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
          <span>{props.t("残コイン", "Available")}</span>
          <strong>{currency.format(available)}</strong>
        </div>
      </section>

      <section className="contestant-list">
        {props.room.contestants.map((contestant, index) => (
          <button
            className={props.selectedPickIds.includes(contestant.id) ? "contestant selected" : "contestant"}
            key={contestant.id}
            type="button"
            onClick={() => props.onPickContestant(contestant.id)}
          >
            <span className="rank-chip">{index + 1}</span>
            <span className="avatar" style={{ "--accent": contestant.accent } as CSSProperties}>
              {contestant.icon}
            </span>
            <span className="contestant-name">{contestant.name}</span>
            <strong>{contestant.odds.toFixed(2)}x</strong>
            <span className="select-circle">
              {props.selectedPickIds.includes(contestant.id) ? `${props.selectedPickIds.indexOf(contestant.id) + 1}` : ""}
            </span>
          </button>
        ))}
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

      {pickCount > 1 && (
        <section className="order-ticket">
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
              ? `${placeMultiplier(props.betType, selectedContestants).toFixed(2)}x`
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
        <div className="quick-grid">
          {quickAmounts.map((quickAmount) => (
            <button key={quickAmount} type="button" onClick={() => props.setAmount(quickAmount)}>
              {quickAmount}
            </button>
          ))}
          <button type="button" onClick={() => props.setAmount(available)}>
            {props.t("全額", "All")}
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

function HostView(props: {
  room: Room;
  newPlayerName: string;
  setNewPlayerName: (value: string) => void;
  newPlayerOffline: boolean;
  setNewPlayerOffline: (value: boolean) => void;
  newPlayerSkill: number;
  setNewPlayerSkill: (value: number) => void;
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
  resultIds: string[];
  themeCopy: Record<ThemeName, { label: string; note: string }>;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  t: Translate;
  onAddPlayer: () => void;
  onAddContestant: () => void;
  onOddsChange: (contestantId: string, odds: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onRoomNameChange: (name: string) => void;
  onPlayerSkillChange: (playerId: string, skillRating: number) => void;
  onPlayerEmojiChange: (playerId: string, emoji: string) => void;
  onContestantStrengthChange: (
    contestantId: string,
    patch: Partial<{ strengthRating: number; cpuLevel: number; isCpu: boolean; icon: string }>,
  ) => void;
  onSettingChange: (key: "maxPlayers" | "maxContestants" | "autoOdds", value: number | boolean) => void;
  onAutoOdds: () => void;
  onResultPick: (contestantId: string) => void;
  onSettle: () => void;
  onNextRace: () => void;
}) {
  return (
    <div className="screen-stack">
      <section className="host-panel">
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
          <label className="toggle-label wide">
            <input
              type="checkbox"
              checked={props.room.settings.autoOdds}
              onChange={(event) => props.onSettingChange("autoOdds", event.target.checked)}
            />
            {props.t("自動オッズ", "Auto odds")}
          </label>
        </div>
        <button className="secondary-button full" type="button" onClick={props.onAutoOdds}>
          <Sparkles size={18} />
          {props.t("強さ/CPU Lvから倍率更新", "Update odds from strength / CPU Lv")}
        </button>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Users size={20} />
          <div>
            <h2>{props.t("参加者", "Bettors")}</h2>
            <p>{props.t("代行入力する人もここで登録", "Register proxy players here too")}</p>
          </div>
        </div>
        <div className="inline-form">
          <input value={props.newPlayerName} onChange={(event) => props.setNewPlayerName(event.target.value)} placeholder={props.t("名前", "Name")} />
          <input
            className="small-input"
            type="number"
            min="1"
            max="9"
            value={props.newPlayerSkill}
            onChange={(event) => props.setNewPlayerSkill(Number(event.target.value))}
            aria-label={props.t("参加者の強さ", "Bettor strength")}
          />
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={props.newPlayerOffline}
              onChange={(event) => props.setNewPlayerOffline(event.target.checked)}
            />
            {props.t("代行", "Proxy")}
          </label>
          <button type="button" onClick={props.onAddPlayer} aria-label={props.t("参加者を追加", "Add bettor")}>
            <Plus size={18} />
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
              <span>{player.isOffline ? props.t("代行", "Proxy") : props.t("本人", "Self")} / {props.t("強さ", "Power")} {player.skillRating}</span>
              <EmojiPicker
                value={player.emoji}
                onChange={(emoji) => props.onPlayerEmojiChange(player.id, emoji)}
                label={props.t(`${player.name}のアイコン`, `${player.name}'s icon`)}
                compact
              />
              <input
                type="range"
                min="1"
                max="9"
                value={player.skillRating}
                onChange={(event) => props.onPlayerSkillChange(player.id, Number(event.target.value))}
                aria-label={props.t(`${player.name}の強さ`, `${player.name}'s strength`)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Settings2 size={20} />
          <div>
            <h2>{props.t("オッズ設定", "Odds Settings")}</h2>
            <p>{props.t("強さに合わせて自動、または倍率を手動調整", "Auto-adjust by power or edit odds manually")}</p>
          </div>
        </div>
        <div className="inline-form">
          <input
            value={props.newContestantName}
            onChange={(event) => props.setNewContestantName(event.target.value)}
            placeholder={props.t("対戦者名", "Contestant")}
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

      <section className="host-panel">
        <div className="section-heading">
          <BarChart3 size={20} />
          <div>
            <h2>{props.t("ベット状況", "Bet Status")}</h2>
            <p>{props.t(`${props.room.currentRace.bets.length}件のベットを受付済み`, `${props.room.currentRace.bets.length} bets placed`)}</p>
          </div>
        </div>
        <div className="bet-log">
          {props.room.currentRace.bets.length === 0 && <p className="muted">{props.t("まだベットはありません。", "No bets yet.")}</p>}
          {props.room.currentRace.bets.map((bet) => {
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
                {bet.placedBy === "host" && <em>{props.t("代行", "Proxy")}</em>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Trophy size={20} />
          <div>
            <h2>{props.t("結果入力", "Enter Results")}</h2>
            <p>{props.t("1位から順にタップして確定", "Tap players in finishing order")}</p>
          </div>
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
        <button className="primary-button" type="button" onClick={props.onSettle}>
          {props.t("結果を確定", "Settle Results")}
          <Check size={20} />
        </button>
        <button className="secondary-button full" type="button" onClick={props.onNextRace}>
          <RotateCcw size={18} />
          {props.t("次の勝負へ", "Next round")}
        </button>
      </section>
    </div>
  );
}

function RankingView(props: { room: Room; ranking: Player[]; t: Translate }) {
  return (
    <div className="screen-stack">
      <section className="leader-preview full">
        <div className="section-heading">
          <Crown size={20} />
          <div>
            <h2>{props.t("リアルタイムランキング", "Live Ranking")}</h2>
            <p>{props.t("コインが0になった人も表示します", "Players at 0 coins stay visible")}</p>
          </div>
        </div>
        {props.ranking.map((player, index) => (
          <PlayerRankRow key={player.id} player={player} rank={index + 1} t={props.t} />
        ))}
      </section>

      {props.room.currentRace.status === "settled" && (
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
  return (
    <div className={props.player.balance <= 0 ? "rank-row bankrupt" : "rank-row"}>
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
