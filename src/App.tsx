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
  clampLimit,
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
import { isFirebaseConfigured, saveFirebaseRoom, subscribeFirebaseRoom } from "./lib/firebase";
import { loadRoom, loadSession, resetLocalRoom, saveRoom, saveSession } from "./lib/storage";
import type { BetType, DraftBet, Player, Room, ThemeName } from "./lib/types";

type TabKey = "home" | "bet" | "host" | "ranking";

const themeLabels: Record<ThemeName, string> = {
  party: "Party",
  neon: "Neon",
  pop: "Pop",
  minimal: "Minimal",
};

const betTypeLabels: Record<BetType, { title: string; note: string }> = {
  win: { title: "単勝", note: "1着を当てる" },
  place: { title: "複勝", note: "3着以内を当てる" },
  exacta: { title: "2連単", note: "1着・2着を順番通り" },
  trifecta: { title: "3連単", note: "1着から3着まで順番通り" },
};

const quickAmounts = [10, 50, 100, 250, 500];

function formatTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantOdds, setNewContestantOdds] = useState(2.5);
  const [newContestantStrength, setNewContestantStrength] = useState(7);
  const [newContestantCpuLevel, setNewContestantCpuLevel] = useState(7);
  const [newContestantIsCpu, setNewContestantIsCpu] = useState(true);
  const [resultIds, setResultIds] = useState<string[]>(room.currentRace.resultIds);
  const [toast, setToast] = useState("");
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    document.documentElement.dataset.theme = room.theme;
  }, [room.theme]);

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
    if (!isFirebaseConfigured) return;

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
  }, [room.id]);

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
  const hasJackpot = room.currentRace.status === "settled" && room.currentRace.bets.some((bet) => {
    const contestant = getContestant(room, getBetPickIds(bet)[0]);
    return contestant && contestant.odds >= 4 && isBetHit(bet.type, getBetPickIds(bet), room.currentRace.resultIds);
  });

  function commitRoom(nextRoom: Room, sync = true) {
    setRoom(nextRoom);
    saveRoom(nextRoom);
    if (sync && isFirebaseConfigured) {
      saveFirebaseRoom(nextRoom).catch(() => {
        setToast("Firebase保存に失敗しました。ローカル状態は保持しています。");
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
    const next = createBlankRoom("みんなBET Arena");
    commitRoom(next);
    setSession({ role: "host" });
    setProxyPlayerId(next.players[0]?.id ?? "");
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    setJoinRoomId(next.id);
    showToast("新しいルームを作成しました。");
  }

  function handleJoinPlayer() {
    const normalizedRoomId = joinRoomId.trim().toUpperCase();
    if (normalizedRoomId !== room.id || joinCode.trim() !== room.joinCode) {
      showToast("ルームIDまたは参加コードが違います。");
      return;
    }

    const name = joinName.trim() || `Player ${room.players.length + 1}`;
    if (room.players.length >= room.settings.maxPlayers) {
      showToast(`賭ける人は最大${room.settings.maxPlayers}人までです。`);
      return;
    }

    const player: Player = {
      id: crypto.randomUUID(),
      name,
      balance: room.startingBalance,
      isOffline: false,
      accent: ["#55f3ec", "#9d7cff", "#ffcf5b", "#ff8f70"][room.players.length % 4],
      skillRating: 5,
    };

    const next = {
      ...room,
      players: [...room.players, player],
      updatedAt: Date.now(),
    };
    commitRoom(next);
    setSession({ role: "player", playerId: player.id });
    setTab("bet");
    showToast(`${name}で参加しました。`);
  }

  function handlePlaceBet() {
    const error = validateBet(room, draftBet);
    if (error) {
      showToast(error);
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
    showToast("BETを受け付けました。");
  }

  function handleAddPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    if (room.players.length >= room.settings.maxPlayers) {
      showToast(`賭ける人は最大${room.settings.maxPlayers}人までです。`);
      return;
    }

    updateRoom((current) => ({
      ...current,
      players: [
        ...current.players,
        {
          id: crypto.randomUUID(),
          name,
          balance: current.startingBalance,
          isOffline: newPlayerOffline,
          accent: ["#55f3ec", "#9d7cff", "#ffcf5b", "#ff8f70"][current.players.length % 4],
          skillRating: clampLimit(newPlayerSkill),
        },
      ],
      updatedAt: Date.now(),
    }));
    setNewPlayerName("");
    showToast("プレイヤーを追加しました。");
  }

  function handleAddContestant() {
    const name = newContestantName.trim();
    if (!name) return;
    if (room.contestants.length >= room.settings.maxContestants) {
      showToast(`プレイヤーは最大${room.settings.maxContestants}人までです。`);
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
              icon: "sparkle",
              strengthRating: clampLimit(newContestantStrength),
              cpuLevel: clampLimit(newContestantCpuLevel),
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
              icon: "sparkle",
              strengthRating: clampLimit(newContestantStrength),
              cpuLevel: clampLimit(newContestantCpuLevel),
              isCpu: newContestantIsCpu,
            },
          ],
      updatedAt: Date.now(),
    }));
    setNewContestantName("");
    setNewContestantOdds(2.5);
    setNewContestantStrength(7);
    setNewContestantCpuLevel(7);
    showToast("競走対象を追加しました。");
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
    patch: Partial<{ strengthRating: number; cpuLevel: number; isCpu: boolean }>,
  ) {
    updateRoom((current) => {
      const contestants = current.contestants.map((contestant) =>
        contestant.id === contestantId
          ? {
              ...contestant,
              ...patch,
              strengthRating: clampLimit(patch.strengthRating ?? contestant.strengthRating),
              cpuLevel: clampLimit(patch.cpuLevel ?? contestant.cpuLevel),
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
        player.id === playerId ? { ...player, skillRating: clampLimit(skillRating) } : player,
      ),
      updatedAt: Date.now(),
    }));
  }

  function handleSettingChange(key: "maxPlayers" | "maxContestants" | "autoOdds", value: number | boolean) {
    updateRoom((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: typeof value === "number" ? clampLimit(value) : value,
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
    showToast("強さ/CPU Lvからオッズを自動調整しました。");
  }

  function handleResultPick(contestantId: string) {
    setResultIds((current) => {
      if (current.includes(contestantId)) return current.filter((id) => id !== contestantId);
      return [...current, contestantId];
    });
  }

  function handleSettle() {
    if (resultIds.length !== room.contestants.length) {
      showToast("1位から最下位まで順番に選んでください。");
      return;
    }
    commitRoom(settleRoom(room, resultIds));
    setTab("ranking");
    showToast("結果を確定して配当を反映しました。");
  }

  function handleNextRace() {
    const next = startNextRace(room);
    commitRoom(next);
    setResultIds([]);
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    showToast("次の勝負を開始しました。");
  }

  function handleResetDemo() {
    const next = resetLocalRoom();
    setRoom(next);
    setSession({ role: "host" });
    setTab("home");
    setProxyPlayerId(next.players[0]?.id ?? "");
    setSelectedContestantId(next.contestants[0]?.id ?? "");
    setSelectedPickIds(next.contestants[0]?.id ? [next.contestants[0].id] : []);
    showToast("デモ状態をリセットしました。");
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
            <button className="pill-button" type="button" onClick={() => setSession({ role: "host" })}>
              <Crown size={18} />
              Host
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="ゲストモード"
              onClick={() => setSession({ role: "player", playerId: currentPlayer?.id })}
            >
              <Users size={20} />
            </button>
          </div>
        </header>

        <section className="status-strip">
          <div>
            <span>Room</span>
            <strong>{room.id}</strong>
          </div>
          <div>
            <span>Code</span>
            <strong>{room.joinCode}</strong>
          </div>
          <div>
            <span>{isFirebaseConfigured ? "Sync" : "Local"}</span>
            <strong className={isFirebaseConfigured ? "online" : ""}>
              {isFirebaseConfigured ? "Firebase" : "Demo"}
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
          />
        ) : (
          <>
            {tab === "home" && (
              <HomeView
                room={room}
                ranking={ranking}
                timeLeft={timeLeft}
                hasJackpot={hasJackpot}
                onCreateRoom={handleCreateRoom}
                onBetTab={() => setTab("bet")}
                onResetDemo={handleResetDemo}
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
                resultIds={resultIds}
                onAddPlayer={handleAddPlayer}
                onAddContestant={handleAddContestant}
                onOddsChange={handleOddsChange}
                onThemeChange={handleThemeChange}
                onPlayerSkillChange={handlePlayerSkillChange}
                onContestantStrengthChange={handleContestantStrengthChange}
                onSettingChange={handleSettingChange}
                onAutoOdds={handleAutoOdds}
                onResultPick={handleResultPick}
                onSettle={handleSettle}
                onNextRace={handleNextRace}
              />
            )}

            {tab === "ranking" && <RankingView room={room} ranking={ranking} />}
          </>
        )}

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        <BottomNav active={tab} role={session.role} onChange={setTab} />
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
}) {
  return (
    <section className="join-panel">
      <div className="section-heading">
        <Users size={20} />
        <div>
          <h2>プレイヤー参加</h2>
          <p>ホストから共有されたIDとコードを入力</p>
        </div>
      </div>
      <label>
        名前
        <input value={props.joinName} onChange={(event) => props.setJoinName(event.target.value)} placeholder="ニックネーム" />
      </label>
      <label>
        Room ID
        <input value={props.joinRoomId} onChange={(event) => props.setJoinRoomId(event.target.value)} placeholder="DEMO42" />
      </label>
      <label>
        参加コード
        <input
          inputMode="numeric"
          value={props.joinCode}
          onChange={(event) => props.setJoinCode(event.target.value)}
          placeholder="2468"
        />
      </label>
      <button className="primary-button" type="button" onClick={props.onJoin}>
        参加する
        <ChevronRight size={22} />
      </button>
    </section>
  );
}

function HomeView(props: {
  room: Room;
  ranking: Player[];
  timeLeft: string;
  hasJackpot: boolean;
  onCreateRoom: () => void;
  onBetTab: () => void;
  onResetDemo: () => void;
}) {
  const betCount = props.room.currentRace.bets.length;

  return (
    <div className="screen-stack">
      <section className="race-hero">
        <div>
          <p className="badge">開催中</p>
          <h2>{props.room.currentRace.title}</h2>
          <p>スマブラ、マリカ、カラオケまで使える身内コインBET</p>
        </div>
        <div className="timer">
          <Radio size={18} />
          {props.timeLeft}
        </div>
      </section>

      {props.hasJackpot && (
        <section className="jackpot">
          <Sparkles size={22} />
          大穴的中が出ました
        </section>
      )}

      <section className="metric-grid">
        <Metric icon={<Users size={20} />} label="Players" value={props.room.players.length.toString()} />
        <Metric icon={<Gamepad2 size={20} />} label="Targets" value={props.room.contestants.length.toString()} />
        <Metric icon={<CircleDollarSign size={20} />} label="Bets" value={betCount.toString()} />
      </section>

      <section className="leader-preview">
        <div className="section-heading">
          <Trophy size={20} />
          <div>
            <h2>ランキング</h2>
            <p>保有コイン順でリアルタイム更新</p>
          </div>
        </div>
        {props.ranking.slice(0, 3).map((player, index) => (
          <PlayerRankRow key={player.id} player={player} rank={index + 1} compact />
        ))}
      </section>

      <section className="action-row">
        <button className="primary-button" type="button" onClick={props.onBetTab}>
          BETへ
          <ChevronRight size={22} />
        </button>
        <button className="secondary-button" type="button" onClick={props.onCreateRoom}>
          <Plus size={18} />
          新規ルーム
        </button>
        <button className="secondary-button icon-only" type="button" aria-label="デモリセット" onClick={props.onResetDemo}>
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
              <h2>幹事代行入力</h2>
              <p>スマホを使わない参加者のBETを代理受付</p>
            </div>
          </div>
          <select value={props.proxyPlayerId} onChange={(event) => props.setProxyPlayerId(event.target.value)}>
            {props.room.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.isOffline ? " / 代行" : ""}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="balance-banner">
        <div>
          <span>Player</span>
          <strong>{props.activePlayer?.name ?? "未選択"}</strong>
        </div>
        <div>
          <span>Available</span>
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
              {contestant.name.slice(0, 1)}
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
            <strong>{betTypeLabels[type].title}</strong>
            <span>{betTypeLabels[type].note}</span>
          </button>
        ))}
      </section>

      {pickCount > 1 && (
        <section className="order-ticket">
          {Array.from({ length: pickCount }).map((_, index) => {
            const contestant = selectedContestants[index];
            return (
              <div key={index}>
                <span>{index + 1}着</span>
                <strong>{contestant?.name ?? "未選択"}</strong>
              </div>
            );
          })}
        </section>
      )}

      <section className="amount-panel">
        <div className="amount-header">
          <span>BET額</span>
          <strong>
            {selectedContestants.length === pickCount
              ? `${placeMultiplier(props.betType, selectedContestants).toFixed(2)}x`
              : "-"}
          </strong>
        </div>
        <div className="stepper">
          <button type="button" onClick={() => props.setAmount(Math.max(0, props.amount - 10))} aria-label="BET額を減らす">
            <Minus size={20} />
          </button>
          <div>
            <strong>{currency.format(props.amount)}</strong>
            <span>coins</span>
          </div>
          <button type="button" onClick={() => props.setAmount(props.amount + 10)} aria-label="BET額を増やす">
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
            全額
          </button>
        </div>
      </section>

      <section className="payout-preview">
        <div>
          <Sparkles size={24} />
          <span>的中時の獲得見込み</span>
        </div>
        <strong>{currency.format(props.potentialPayout)} コイン</strong>
      </section>

      <button className="primary-button sticky-action" type="button" onClick={props.onPlaceBet}>
        BETする
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
  resultIds: string[];
  onAddPlayer: () => void;
  onAddContestant: () => void;
  onOddsChange: (contestantId: string, odds: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onPlayerSkillChange: (playerId: string, skillRating: number) => void;
  onContestantStrengthChange: (
    contestantId: string,
    patch: Partial<{ strengthRating: number; cpuLevel: number; isCpu: boolean }>,
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
            <h2>ホスト管理</h2>
            <p>Room ID {props.room.id} / 参加コード {props.room.joinCode}</p>
          </div>
        </div>
        <div className="theme-row">
          {(Object.keys(themeLabels) as ThemeName[]).map((theme) => (
            <button
              className={props.room.theme === theme ? "theme-button selected" : "theme-button"}
              key={theme}
              type="button"
              onClick={() => props.onThemeChange(theme)}
            >
              {themeLabels[theme]}
            </button>
          ))}
        </div>
        <div className="settings-grid">
          <label>
            賭ける人
            <input
              type="number"
              min="1"
              max="8"
              value={props.room.settings.maxPlayers}
              onChange={(event) => props.onSettingChange("maxPlayers", Number(event.target.value))}
            />
          </label>
          <label>
            プレイヤー
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
            自動オッズ
          </label>
        </div>
        <button className="secondary-button full" type="button" onClick={props.onAutoOdds}>
          <Sparkles size={18} />
          強さ/CPU Lvから倍率更新
        </button>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Users size={20} />
          <div>
            <h2>参加者</h2>
            <p>代行入力対象もここで登録</p>
          </div>
        </div>
        <div className="inline-form">
          <input value={props.newPlayerName} onChange={(event) => props.setNewPlayerName(event.target.value)} placeholder="名前" />
          <input
            className="small-input"
            type="number"
            min="1"
            max="9"
            value={props.newPlayerSkill}
            onChange={(event) => props.setNewPlayerSkill(Number(event.target.value))}
            aria-label="参加者の強さ"
          />
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={props.newPlayerOffline}
              onChange={(event) => props.setNewPlayerOffline(event.target.checked)}
            />
            代行
          </label>
          <button type="button" onClick={props.onAddPlayer} aria-label="参加者を追加">
            <Plus size={18} />
          </button>
        </div>
        <div className="player-grid">
          {props.room.players.map((player) => (
            <div className="mini-player" key={player.id}>
              <span className="avatar" style={{ "--accent": player.accent } as CSSProperties}>
                {player.name.slice(0, 1)}
              </span>
              <strong>{player.name}</strong>
              <span>{player.isOffline ? "代行" : "本人"} / 強さ{player.skillRating}</span>
              <input
                type="range"
                min="1"
                max="9"
                value={player.skillRating}
                onChange={(event) => props.onPlayerSkillChange(player.id, Number(event.target.value))}
                aria-label={`${player.name}の強さ`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Settings2 size={20} />
          <div>
            <h2>オッズ設定</h2>
            <p>勝負ごとに倍率を手動調整</p>
          </div>
        </div>
        <div className="inline-form">
          <input
            value={props.newContestantName}
            onChange={(event) => props.setNewContestantName(event.target.value)}
            placeholder="対象名"
          />
          <input
            className="small-input"
            type="number"
            min="1"
            max="9"
            value={props.newContestantCpuLevel}
            onChange={(event) => props.setNewContestantCpuLevel(Number(event.target.value))}
            aria-label="CPU Lv"
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
            CPU
          </label>
          <button type="button" onClick={props.onAddContestant} aria-label="競走対象を追加">
            <Plus size={18} />
          </button>
        </div>
        {props.room.contestants.map((contestant) => (
          <div className="odds-row expanded" key={contestant.id}>
            <span className="avatar" style={{ "--accent": contestant.accent } as CSSProperties}>
              {contestant.name.slice(0, 1)}
            </span>
            <strong>{contestant.name}</strong>
            <label className="toggle-label compact">
              <input
                type="checkbox"
                checked={contestant.isCpu}
                onChange={(event) => props.onContestantStrengthChange(contestant.id, { isCpu: event.target.checked })}
              />
              CPU
            </label>
            <label>
              強さ
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
          </div>
        ))}
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <BarChart3 size={20} />
          <div>
            <h2>BET状況</h2>
            <p>{props.room.currentRace.bets.length}件のBETを受付済み</p>
          </div>
        </div>
        <div className="bet-log">
          {props.room.currentRace.bets.length === 0 && <p className="muted">まだBETはありません。</p>}
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
                <span>{betTypeLabels[bet.type].title}</span>
                <strong>{currency.format(bet.amount)}</strong>
                {bet.placedBy === "host" && <em>代行</em>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="host-panel">
        <div className="section-heading">
          <Trophy size={20} />
          <div>
            <h2>結果入力</h2>
            <p>1位から順にタップして確定</p>
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
                <span>{position >= 0 ? `${position + 1}位` : "-"}</span>
                {contestant.name}
              </button>
            );
          })}
        </div>
        <button className="primary-button" type="button" onClick={props.onSettle}>
          結果を確定
          <Check size={20} />
        </button>
        <button className="secondary-button full" type="button" onClick={props.onNextRace}>
          <RotateCcw size={18} />
          次の勝負へ
        </button>
      </section>
    </div>
  );
}

function RankingView(props: { room: Room; ranking: Player[] }) {
  return (
    <div className="screen-stack">
      <section className="leader-preview full">
        <div className="section-heading">
          <Crown size={20} />
          <div>
            <h2>リアルタイムランキング</h2>
            <p>破産者は0コインで固定表示</p>
          </div>
        </div>
        {props.ranking.map((player, index) => (
          <PlayerRankRow key={player.id} player={player} rank={index + 1} />
        ))}
      </section>

      {props.room.currentRace.status === "settled" && (
        <section className="result-summary">
          <div className="section-heading">
            <Medal size={20} />
            <div>
              <h2>確定結果</h2>
              <p>配当計算済み</p>
            </div>
          </div>
          {props.room.currentRace.resultIds.map((id, index) => {
            const contestant = getContestant(props.room, id);
            return (
              <div className="result-line" key={id}>
                <span>{index + 1}</span>
                <strong>{contestant?.name ?? "Unknown"}</strong>
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

function PlayerRankRow(props: { player: Player; rank: number; compact?: boolean }) {
  return (
    <div className={props.player.balance <= 0 ? "rank-row bankrupt" : "rank-row"}>
      <span className="rank-number">{props.rank}</span>
      <span className="avatar" style={{ "--accent": props.player.accent } as CSSProperties}>
        {props.player.name.slice(0, 1)}
      </span>
      <strong>{props.player.name}</strong>
      {!props.compact && <span>{props.player.isOffline ? "代行参加" : "本人参加"}</span>}
      <span className="coin">
        <CircleDollarSign size={16} />
        {currency.format(props.player.balance)}
      </span>
    </div>
  );
}

function BottomNav(props: { active: TabKey; role: "host" | "player"; onChange: (tab: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; hostOnly?: boolean }> = [
    { key: "home", label: "ホーム", icon: <Home size={22} /> },
    { key: "bet", label: "BET", icon: <Zap size={22} /> },
    { key: "host", label: "管理", icon: <Settings2 size={22} />, hostOnly: true },
    { key: "ranking", label: "順位", icon: <Wallet size={22} /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
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
