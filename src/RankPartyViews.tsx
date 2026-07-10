import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Flag,
  Gamepad2,
  Home,
  Info,
  LogIn,
  Medal,
  Minus,
  Moon,
  Plus,
  Radio,
  Save,
  Settings2,
  Share2,
  Sun,
  Ticket,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import {
  currency,
  getAvailableBalance,
  getBetPickIds,
  getContestant,
  getEffectiveMultiplier,
  rankedPlayers,
  requiredPickCount,
} from "./lib/calculations";
import type { LocalRoomSummary } from "./lib/storage";
import type {
  BetType,
  LanguageName,
  Player,
  RaceBetResult,
  Room,
  ThemeName,
  UiModeName,
} from "./lib/types";

export type RankTabKey = "home" | "bet" | "host" | "ranking";
type Translate = (ja: string, en: string) => string;
type BetDisplayMode = "cards" | "board";
type ResultDisplayMode = "ranking" | "payouts";
type HostSection = "progress" | "settings" | "players" | "contestants";

const languages: Array<{ value: LanguageName; label: string }> = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "uk", label: "Українська" },
];

const emojiChoices = [
  "😀", "😎", "🥳", "🎮", "🎲", "🎯", "🏆", "👑",
  "🔥", "⚡", "🌟", "⭐", "🍀", "🌈", "🍭", "🎤",
  "🎧", "🚗", "🏎️", "🚀", "🛡️", "💎", "🤖", "🍄",
];

const levelChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const quickAmounts = [10, 50, 100, 500, 1000, 5000];

function LanguageSelect(props: {
  value: LanguageName;
  onChange: (value: LanguageName) => void;
  label: string;
}) {
  return (
    <label className="rp-language">
      <span className="sr-only">{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as LanguageName)}>
        {languages.map((language) => (
          <option value={language.value} key={language.value}>{language.label}</option>
        ))}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </label>
  );
}

function IconSelect(props: { value: string; label: string; onChange: (value: string) => void }) {
  return (
    <label className="rp-icon-select" aria-label={props.label}>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {emojiChoices.map((emoji) => <option value={emoji} key={emoji}>{emoji}</option>)}
      </select>
      <span aria-hidden="true">{props.value}</span>
    </label>
  );
}

export function RankLaunchView(props: {
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
  const [showJoin, setShowJoin] = useState(false);
  const canJoin = Boolean(props.joinRoomId.trim() && props.joinCode.trim());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector<HTMLElement>(".phone-frame")?.scrollTo({ top: 0, behavior: "auto" });
  }, [showJoin]);

  if (showJoin) {
    return (
      <div className="rp-entry rp-join-entry">
        <header className="rp-entry-topbar">
          <button className="rp-icon-button" type="button" onClick={() => setShowJoin(false)} aria-label={props.t("戻る", "Back")}>
            <ArrowLeft size={26} />
          </button>
          <LanguageSelect value={props.language} onChange={props.onLanguageChange} label={props.t("言語を選ぶ", "Choose language")} />
        </header>

        <div className="rp-page-heading">
          <h1>{props.t("ルームに参加", "Join a room")}</h1>
          <p>{props.t("招待されたルーム情報を入力してください", "Enter the room details you received")}</p>
        </div>

        <form
          className="rp-form-card"
          onSubmit={(event) => {
            event.preventDefault();
            props.onJoin();
          }}
        >
          <h2>{props.t("参加情報", "Join details")}</h2>
          <label>
            <span>{props.t("表示名", "Display name")}</span>
            <input value={props.joinName} onChange={(event) => props.setJoinName(event.target.value)} placeholder={props.t("例：ゆうた", "Example: Yuta")} />
          </label>
          <label>
            <span>{props.t("ルームID", "Room ID")}</span>
            <input value={props.joinRoomId} onChange={(event) => props.setJoinRoomId(event.target.value.toUpperCase())} placeholder="AB12CD" autoCapitalize="characters" />
          </label>
          <label>
            <span>{props.t("参加コード", "Join code")}</span>
            <input inputMode="numeric" value={props.joinCode} onChange={(event) => props.setJoinCode(event.target.value)} placeholder="2468" />
          </label>
          <button className="rp-primary-button" type="submit" disabled={!canJoin}>{props.t("参加する", "Join")}</button>
          <p className="rp-form-help">{props.t("幹事から共有されたIDとコードを入力してください", "Use the ID and code shared by the host")}</p>
        </form>

        {props.roomSummaries.length > 0 && (
          <button className="rp-saved-link" type="button" onClick={() => props.onOpenRoom(props.roomSummaries[0].id)}>
            <Bookmark size={25} />
            <strong>{props.t("保存済みルームから選ぶ", "Choose a saved room")}</strong>
            <ChevronRight size={25} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rp-entry rp-launch">
      <header className="rp-launch-tools">
        <LanguageSelect value={props.language} onChange={props.onLanguageChange} label={props.t("言語を選ぶ", "Choose language")} />
      </header>
      <h1>{props.t("さあ、\n始めよう。", "Let's\nget started.")}</h1>

      <div className="rp-launch-actions">
        <button className="rp-launch-card rp-launch-create" type="button" onClick={props.onCreateRoom}>
          <span className="rp-launch-symbol"><Plus size={44} /></span>
          <span className="rp-launch-copy">
            <strong>{props.t("ルームを作る", "Create a room")}</strong>
            <small>{props.t("新しいルームを作成して\nゲームを始めましょう", "Create a new room and start the game")}</small>
          </span>
          <span className="rp-launch-arrow"><ChevronRight size={28} /></span>
        </button>
        <button className="rp-launch-card rp-launch-join" type="button" onClick={() => setShowJoin(true)}>
          <span className="rp-launch-symbol"><LogIn size={43} /></span>
          <span className="rp-launch-copy">
            <strong>{props.t("ルームに参加", "Join a room")}</strong>
            <small>{props.t("招待コードを入力して\nルームに参加します", "Enter an invitation code and join")}</small>
          </span>
          <span className="rp-launch-arrow"><ChevronRight size={28} /></span>
        </button>
      </div>

      {props.roomSummaries.length > 0 && (
        <details className="rp-saved-rooms">
          <summary>
            <strong>{props.t("保存済みルーム", "Saved rooms")}</strong>
            <ChevronDown size={22} />
          </summary>
          <div className="rp-saved-list">
            {props.roomSummaries.map((summary) => (
              <div className="rp-saved-row" key={summary.id}>
                <button type="button" onClick={() => props.onOpenRoom(summary.id)}>
                  <Bookmark size={20} />
                  <span>
                    <strong>{summary.name}</strong>
                    <small>{props.t(`第${summary.currentRaceNumber}/${summary.maxRaces}レース`, `Race ${summary.currentRaceNumber}/${summary.maxRaces}`)}</small>
                  </span>
                  <ChevronRight size={20} />
                </button>
                <button className="rp-delete-icon" type="button" onClick={() => props.onDeleteRoom(summary.id)} aria-label={props.t("ルームを削除", "Delete room")}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function RankJoinPanel(props: {
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
    <div className="rp-entry rp-inline-join">
      <div className="rp-page-heading">
        <h1>{props.t("ルームに参加", "Join a room")}</h1>
        <p>{props.t("幹事から共有された情報を入力してください", "Enter the details shared by the host")}</p>
      </div>
      <form className="rp-form-card" onSubmit={(event) => { event.preventDefault(); props.onJoin(); }}>
        <label><span>{props.t("表示名", "Display name")}</span><input value={props.joinName} onChange={(event) => props.setJoinName(event.target.value)} /></label>
        <label><span>{props.t("ルームID", "Room ID")}</span><input value={props.joinRoomId} onChange={(event) => props.setJoinRoomId(event.target.value.toUpperCase())} /></label>
        <label><span>{props.t("参加コード", "Join code")}</span><input inputMode="numeric" value={props.joinCode} onChange={(event) => props.setJoinCode(event.target.value)} /></label>
        <button className="rp-primary-button" type="submit">{props.t("参加する", "Join")}</button>
      </form>
    </div>
  );
}

export function RankRoomHeader(props: {
  tab: RankTabKey;
  room: Room;
  sessionRole: "host" | "player";
  activePlayer?: Player;
  currentRaceNumber: number;
  t: Translate;
  onBack: () => void;
  onHostMode: () => void;
  onJoinMode: () => void;
}) {
  const balance = props.activePlayer?.balance ?? props.room.players[0]?.balance ?? props.room.startingBalance;
  const isHostSurface = props.tab === "home" || props.tab === "host";
  const isBet = props.tab === "bet";

  if (isHostSurface) {
    return (
      <header className="rp-room-header rp-host-header">
        <div className="rp-room-brand">
          <span className="rp-brand-mark"><Crown size={28} /></span>
          <span>
            <strong>{props.t("ホストルーム", "Host room")}</strong>
            <small>{props.room.name || props.t("新しい勝負", "New match")}</small>
          </span>
        </div>
        <span className="rp-live-pill"><i />{props.t("進行中", "Live")}</span>
      </header>
    );
  }

  return (
    <header className="rp-room-header rp-section-header">
      <button className="rp-icon-button" type="button" onClick={props.onBack} aria-label={props.t("ルームを閉じる", "Leave room")}>
        <ArrowLeft size={25} />
      </button>
      <div className="rp-section-title">
        <span className="rp-brand-mark">{isBet ? <Ticket size={25} /> : <Crown size={25} />}</span>
        <strong>{isBet ? props.t("ベット", "Bet") : props.t("ランクパーティ", "Rank Party")}</strong>
      </div>
      <div className="rp-balance-pill">
        <span>{props.t("残高", "Balance")}</span>
        <strong>{currency.format(balance)}</strong>
        {props.tab === "ranking" ? <Bell size={21} /> : <button type="button" onClick={props.sessionRole === "host" ? props.onHostMode : props.onJoinMode}><Plus size={19} /></button>}
      </div>
    </header>
  );
}

export function RankHomeView(props: {
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
  const settled = props.room.currentRace.status === "settled";
  const resultDone = props.room.currentRace.resultIds.length === props.room.contestants.length;
  const openTasks = settled ? 0 : resultDone ? 1 : 2;
  const progress = Math.max(5, Math.min(100, (props.currentRaceNumber / props.room.settings.maxRaces) * 100));

  return (
    <div className="rp-screen rp-home-screen">
      <section className="rp-progress-card">
        <span className="rp-eyebrow">{props.t("現在のレース", "Current race")}</span>
        <h2>{props.t("第", "Race ")} <b>{props.currentRaceNumber}</b> / {props.room.settings.maxRaces} {props.t("レース", "")}</h2>
        <div className="rp-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="rp-progress-stats">
          <div><Ticket size={25} /><span>{props.t("ベット完了", "Bets done")}</span><strong>{props.room.currentRace.bets.length} / {props.room.players.length}</strong></div>
          <div><Settings2 size={25} /><span>{props.t("結果", "Results")}</span><strong>{resultDone ? props.t("入力済み", "Entered") : props.t("未入力", "Pending")}</strong></div>
          <div><CircleDollarSign size={25} /><span>{props.t("精算", "Payout")}</span><strong>{settled ? props.t("処理済み", "Done") : props.t("未処理", "Pending")}</strong></div>
        </div>
      </section>

      <nav className="rp-host-shortcuts" aria-label={props.t("ホスト管理", "Host controls")}>
        <button className="active" type="button">{props.t("進行", "Run")}</button>
        <button type="button" onClick={props.onHostTab}>{props.t("基本", "Setup")}</button>
        <button type="button" onClick={props.onHostTab}>{props.t("参加者", "Bettors")}</button>
        <button type="button" onClick={props.onHostTab}>{props.t("対戦者", "Racers")}</button>
      </nav>

      <div className="rp-action-list">
        <button className="rp-action-card rp-action-primary" type="button" onClick={props.onHostTab}>
          <span><Settings2 size={30} /></span>
          <div><strong>{props.t("結果を入力", "Enter results")}</strong><small>{props.t("着順を入力して精算へ進む", "Enter finish order and continue to payouts")}</small></div>
          <ChevronRight size={26} />
        </button>
        <button className="rp-action-card" type="button" onClick={props.onHostTab}>
          <span><CircleDollarSign size={28} /></span>
          <div><strong>{props.t("配当を精算", "Settle payouts")}</strong><small>{props.t("配当を反映して残高更新", "Apply payouts and update balances")}</small></div>
          <ChevronRight size={25} />
        </button>
        <button className="rp-action-card" type="button" onClick={settled ? props.onHostTab : props.onBetTab}>
          <span><Flag size={28} /></span>
          <div><strong>{props.t("次のレースを開始", "Start next race")}</strong><small>{props.t("次の投票受付を開始", "Open the next betting round")}</small></div>
          <ChevronRight size={25} />
        </button>
      </div>

      <section className="rp-home-summary">
        <div><BarChart3 size={25} /><span>{props.t("未対応タスク", "Open tasks")}</span><strong>{openTasks}{props.t("件", "")}</strong></div>
        <div><Users size={25} /><span>{props.t("参加者", "Bettors")}</span><strong>{props.room.players.length}{props.t("人", "")}</strong></div>
      </section>

      {props.hasJackpot && <div className="rp-jackpot"><Trophy size={20} />{props.t("大穴的中が出ました", "A long-shot winner landed")}</div>}
    </div>
  );
}

function BetTypeTabs(props: {
  value: BetType;
  onChange: (value: BetType) => void;
  labels: Record<BetType, { title: string; note: string }>;
}) {
  return (
    <div className="rp-bet-type-tabs" role="tablist" aria-label="Bet type">
      {(["win", "place", "exacta", "trifecta"] as BetType[]).map((type) => (
        <button className={props.value === type ? "active" : ""} type="button" key={type} onClick={() => props.onChange(type)}>
          {props.labels[type].title}
        </button>
      ))}
    </div>
  );
}

function RacerList(props: {
  room: Room;
  betType: BetType;
  selectedPickIds: string[];
  displayMode: BetDisplayMode;
  onPick: (contestantId: string) => void;
}) {
  const pickCount = requiredPickCount(props.betType);
  return (
    <div className={props.displayMode === "cards" ? "rp-racer-list rp-racer-cards" : "rp-racer-list"}>
      {props.room.contestants.map((contestant, index) => {
        const selectedIndex = props.selectedPickIds.indexOf(contestant.id);
        const selected = selectedIndex >= 0;
        const multiplier = getEffectiveMultiplier(props.room, props.betType, [contestant]);
        return (
          <button className={selected ? "rp-racer-row selected" : "rp-racer-row"} type="button" key={contestant.id} onClick={() => props.onPick(contestant.id)}>
            <span className="rp-lane-number" style={{ "--lane": contestant.accent } as CSSProperties}>{index + 1}</span>
            <span className="rp-racer-avatar" style={{ "--lane": contestant.accent } as CSSProperties}>{contestant.icon}</span>
            <span className="rp-racer-copy">
              <strong>{contestant.name}</strong>
              <small>{contestant.isCpu ? `CPU Lv ${contestant.cpuLevel}` : "PLAYER"}</small>
            </span>
            <span className="rp-racer-odds">
              {pickCount === 1 ? `${multiplier.toFixed(2)}x` : selected ? `${selectedIndex + 1}位` : `${contestant.odds.toFixed(2)}x`}
            </span>
            {selected && <span className="rp-selected-check">{pickCount > 1 ? selectedIndex + 1 : <Check size={18} />}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function RankBetView(props: {
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
  const pickCount = requiredPickCount(props.betType);
  const selectedContestants = props.selectedPickIds
    .map((id) => getContestant(props.room, id))
    .filter((contestant): contestant is NonNullable<ReturnType<typeof getContestant>> => Boolean(contestant));
  const activePlayerPlaced = Boolean(props.activePlayer && props.room.currentRace.bets.some((bet) => bet.playerId === props.activePlayer?.id));
  const available = props.activePlayer ? getAvailableBalance(props.room, props.activePlayer.id) : 0;
  const balance = props.room.settings.allowDebt ? props.activePlayer?.balance ?? 0 : available;
  const selectionComplete = selectedContestants.length === pickCount;
  const multiplier = selectionComplete ? getEffectiveMultiplier(props.room, props.betType, selectedContestants) : 0;
  const bettingOpen = props.room.currentRace.status === "betting";
  const canPlace = bettingOpen && Boolean(props.activePlayer) && selectionComplete && props.amount > 0 && !(props.sessionRole === "player" && activePlayerPlaced);
  const prompt = props.betType === "win"
    ? props.t("1着になる対戦者を予想してください", "Choose the winner")
    : props.betType === "place"
      ? props.t("3着以内に入る対戦者を予想してください", "Choose a top-three finisher")
      : props.betType === "exacta"
        ? props.t("1着・2着を順番に選んでください", "Choose first and second in order")
        : props.t("1着から3着まで順番に選んでください", "Choose first through third in order");

  const adjustAmount = (delta: number) => props.setAmount(Math.max(0, props.amount + delta));

  return (
    <div className="rp-screen rp-bet-screen">
      {props.sessionRole === "player" && activePlayerPlaced && (
        <section className="rp-waiting-card">
          <span><Check size={22} /></span>
          <div>
            <strong>{props.allPlayersPlaced ? props.t("全員のベットが完了しました", "All bets are in") : props.t("ベットを受け付けました", "Your bet is in")}</strong>
            <small>{props.allPlayersPlaced ? props.t("幹事の結果入力を待っています", "Waiting for the host to enter results") : props.t(`${props.placedPlayerCount}/${props.room.players.length}人がベット済みです`, `${props.placedPlayerCount}/${props.room.players.length} players are ready`)}</small>
          </div>
        </section>
      )}

      <section className="rp-bet-card">
        <header className="rp-race-heading">
          <h2>{props.t("第", "Race ")} <b>{props.currentRaceNumber}</b> {props.t("レース", "")}</h2>
          <span className={bettingOpen ? "open" : ""}><Radio size={15} />{bettingOpen ? props.t("受付中", "Open") : props.t("受付終了", "Closed")}</span>
          <details className="rp-race-info">
            <summary><Info size={18} />{props.t("レース情報", "Race info")}</summary>
            <p>{props.t(`全${props.room.settings.maxRaces}レース / 対戦者${props.room.contestants.length}人`, `${props.room.settings.maxRaces} races / ${props.room.contestants.length} racers`)}</p>
          </details>
        </header>

        {props.sessionRole === "host" && (
          <label className="rp-proxy-select">
            <span>{props.t("代行入力する参加者", "Bettor")}</span>
            <select value={props.proxyPlayerId} onChange={(event) => props.setProxyPlayerId(event.target.value)}>
              <option value="">{props.t("代行なし / 参加者を選択", "No proxy / choose bettor")}</option>
              {props.room.players.map((player) => <option value={player.id} key={player.id}>{player.emoji} {player.name}</option>)}
            </select>
          </label>
        )}

        <BetTypeTabs value={props.betType} onChange={props.setBetType} labels={props.betTypeLabels} />
        <p className="rp-bet-prompt">{prompt}</p>

        <div className="rp-view-choice" role="group" aria-label={props.t("表示切り替え", "View")}>
          <button className={props.displayMode === "board" ? "active" : ""} type="button" onClick={() => props.setDisplayMode("board")}>{props.t("馬券表", "Ticket")}</button>
          <button className={props.displayMode === "cards" ? "active" : ""} type="button" onClick={() => props.setDisplayMode("cards")}>{props.t("カード", "Cards")}</button>
        </div>

        <RacerList room={props.room} betType={props.betType} selectedPickIds={props.selectedPickIds} displayMode={props.displayMode} onPick={props.onPickContestant} />
      </section>

      <section className="rp-ticket-card">
        <header>
          <span>{props.t("選択中の投票", "Selected ticket")}</span>
          <button type="button" onClick={() => props.onPickOrder([])}><Trash2 size={16} />{props.t("削除", "Clear")}</button>
        </header>
        <div className="rp-ticket-selection">
          <span>{props.betTypeLabels[props.betType].title}</span>
          {Array.from({ length: pickCount }).map((_, index) => (
            <b key={index}>{selectedContestants[index] ? `${index + 1}  ${selectedContestants[index].name}` : `${index + 1}  -`}</b>
          ))}
        </div>
        <div className="rp-payout-line">
          <span>{props.t("予想払戻", "Estimated payout")} <Info size={16} /></span>
          <strong>{currency.format(props.potentialPayout)}</strong>
          <small>{multiplier ? `(${props.t("オッズ", "Odds")} ${multiplier.toFixed(2)}x)` : "-"}</small>
        </div>
        <div className="rp-amount-heading">
          <span>{props.t("ベット金額", "Bet amount")}</span>
          <small>{props.t("購入可能額", "Available")} {currency.format(balance)}</small>
        </div>
        <div className="rp-amount-stepper">
          <button type="button" onClick={() => adjustAmount(-10)} aria-label={props.t("減らす", "Decrease")}><Minus size={21} /></button>
          <strong>{currency.format(props.amount)}</strong>
          <button type="button" onClick={() => adjustAmount(10)} aria-label={props.t("増やす", "Increase")}><Plus size={21} /></button>
        </div>
        <div className="rp-quick-amounts">
          {quickAmounts.map((value) => (
            <button type="button" key={value} onClick={() => adjustAmount(value)}>+{currency.format(value)}</button>
          ))}
          {quickAmounts.slice(0, 3).map((value) => (
            <button className="minus" type="button" key={`minus-${value}`} onClick={() => adjustAmount(-value)}>-{currency.format(value)}</button>
          ))}
        </div>
        <button className="rp-primary-button rp-place-bet" type="button" onClick={props.onPlaceBet} disabled={!canPlace}>
          {activePlayerPlaced && props.sessionRole === "player" ? props.t("結果待ち", "Waiting") : props.t("ベットする", "Place bet")}
        </button>
      </section>

      <p className="rp-play-money-note"><WalletCards size={17} />{props.t("このアプリは遊び用コインのみを扱います", "This app uses play coins only")}</p>
    </div>
  );
}

function HostTabs(props: { value: HostSection; onChange: (value: HostSection) => void; t: Translate }) {
  const tabs: Array<{ value: HostSection; label: string }> = [
    { value: "progress", label: props.t("進行", "Run") },
    { value: "settings", label: props.t("基本", "Setup") },
    { value: "players", label: props.t("参加者", "Bettors") },
    { value: "contestants", label: props.t("対戦者", "Racers") },
  ];
  return (
    <nav className="rp-host-tabs">
      {tabs.map((tab) => (
        <button className={props.value === tab.value ? "active" : ""} type="button" key={tab.value} onClick={() => props.onChange(tab.value)}>{tab.label}</button>
      ))}
    </nav>
  );
}

function Toggle(props: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="rp-toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <em>{props.label}</em>
    </label>
  );
}

export function RankHostView(props: {
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
  onDeleteContestant: (contestantId: string) => void;
  onOddsChange: (contestantId: string, odds: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onUiModeChange: (uiMode: UiModeName) => void;
  onRoomNameChange: (name: string) => void;
  onStartingBalanceChange: (value: number) => void;
  onPlayerEmojiChange: (playerId: string, emoji: string) => void;
  onContestantLevelChange: (contestantId: string, patch: Partial<{ cpuLevel: number; isCpu: boolean; icon: string }>) => void;
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
  const [section, setSection] = useState<HostSection>("progress");
  const settled = props.room.currentRace.status === "settled";
  const resultComplete = props.resultIds.length === props.room.contestants.length;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector<HTMLElement>(".phone-frame")?.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);

  return (
    <div className="rp-screen rp-host-screen">
      <HostTabs value={section} onChange={setSection} t={props.t} />

      {section === "progress" && (
        <>
          <section className="rp-result-entry">
            <header className="rp-section-heading">
              <span><Trophy size={24} /></span>
              <div><h2>{props.t(`第${props.currentRaceNumber}レース 結果入力`, `Race ${props.currentRaceNumber} results`)}</h2><p>{props.t("着順どおりに対戦者をタップしてください", "Tap racers in finish order")}</p></div>
            </header>
            <div className="rp-flow-steps">
              <span className={!settled ? "active" : "done"}>1. {props.t("順位入力", "Rank")}</span>
              <span className={resultComplete && !settled ? "active" : settled ? "done" : ""}>2. {props.t("払戻反映", "Payout")}</span>
              <span className={settled ? "active" : ""}>3. {props.t("次の勝負", "Next")}</span>
            </div>
            <div className="rp-result-picks">
              {props.room.contestants.map((contestant) => {
                const index = props.resultIds.indexOf(contestant.id);
                return (
                  <button className={index >= 0 ? "selected" : ""} type="button" key={contestant.id} onClick={() => props.onResultPick(contestant.id)} disabled={settled}>
                    <b>{index >= 0 ? index + 1 : "-"}</b>
                    <span>{contestant.icon}</span>
                    <strong>{contestant.name}</strong>
                  </button>
                );
              })}
            </div>
            <button className="rp-primary-button" type="button" onClick={props.onSettle} disabled={!resultComplete || settled}>
              <CircleDollarSign size={20} />{settled ? props.t("払戻を反映済み", "Payouts applied") : props.t("このレースの払戻を反映", "Apply payouts")}
            </button>
            <button className="rp-secondary-button" type="button" onClick={props.onNextRace} disabled={!settled}>
              <Flag size={20} />{props.currentRaceNumber >= props.room.settings.maxRaces ? props.t("最終順位を見る", "View final ranking") : props.t("次のレースを開始", "Start next race")}
            </button>
          </section>

          <section className="rp-bet-status">
            <header className="rp-section-heading">
              <span><BarChart3 size={23} /></span>
              <div><h2>{props.t("ベット状況", "Bet status")}</h2><p>{props.t(`${props.placedPlayerCount}/${props.room.players.length}人がベット済み`, `${props.placedPlayerCount}/${props.room.players.length} bettors ready`)}</p></div>
            </header>
            <div className="rp-bet-status-list">
              {props.room.currentRace.bets.length === 0 ? (
                <p>{props.t("まだベットはありません", "No bets yet")}</p>
              ) : props.room.currentRace.bets.map((bet) => {
                const player = props.room.players.find((item) => item.id === bet.playerId);
                const picks = getBetPickIds(bet).map((id) => getContestant(props.room, id)?.name ?? "-").join(" → ");
                return (
                  <div key={bet.id}><span>{player?.emoji} {player?.name}</span><strong>{picks}</strong><b>{currency.format(bet.amount)}</b></div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {section === "settings" && (
        <section className="rp-settings-page">
          <div className="rp-page-heading compact"><h1>{props.t("基本設定", "Room setup")}</h1><p>{props.t("ルーム情報とゲームルールを管理", "Manage room details and rules")}</p></div>
          <div className="rp-settings-card">
            <label><span>{props.t("勝負名", "Match name")}</span><input value={props.room.name} onChange={(event) => props.onRoomNameChange(event.target.value)} placeholder={props.t("新しい勝負", "New match")} /></label>
            <div className="rp-id-grid">
              <div><span>{props.t("ルームID", "Room ID")}</span><strong>{props.room.id}</strong></div>
              <div><span>{props.t("参加コード", "Join code")}</span><strong>{props.room.joinCode}</strong></div>
            </div>
            <div className="rp-number-grid">
              <label><span>{props.t("全レース数", "Total races")}</span><input type="number" min="1" max="15" value={props.room.settings.maxRaces} onChange={(event) => props.onSettingChange("maxRaces", Number(event.target.value))} /></label>
              <label><span>{props.t("初期コイン", "Starting coins")}</span><input type="number" value={props.room.startingBalance} onChange={(event) => props.onStartingBalanceChange(Number(event.target.value))} /></label>
              <label><span>{props.t("参加者上限", "Bettor limit")}</span><input type="number" min="1" max="8" value={props.room.settings.maxPlayers} onChange={(event) => props.onSettingChange("maxPlayers", Number(event.target.value))} /></label>
              <label><span>{props.t("対戦者上限", "Racer limit")}</span><input type="number" min="1" max="8" value={props.room.settings.maxContestants} onChange={(event) => props.onSettingChange("maxContestants", Number(event.target.value))} /></label>
            </div>
            <div className="rp-toggle-list">
              <Toggle checked={props.room.settings.autoOdds} label={props.t("CPUレベルからオッズを自動計算", "Auto-calculate odds from CPU level")} onChange={(checked) => props.onSettingChange("autoOdds", checked)} />
              <Toggle checked={props.room.settings.marketOdds} label={props.t("投票量に応じて倍率を変動", "Move odds with the betting pool")} onChange={(checked) => props.onSettingChange("marketOdds", checked)} />
              <Toggle checked={props.room.settings.allowDebt} label={props.t("マイナス残高でも続行", "Allow debt betting")} onChange={(checked) => props.onSettingChange("allowDebt", checked)} />
            </div>
            <div className="rp-theme-choice">
              <span>{props.t("表示テーマ", "Theme")}</span>
              <button className={props.room.theme !== "neon" ? "active" : ""} type="button" onClick={() => props.onThemeChange("arena")}><Sun size={18} />{props.t("ライト", "Light")}</button>
              <button className={props.room.theme === "neon" ? "active" : ""} type="button" onClick={() => props.onThemeChange("neon")}><Moon size={18} />{props.t("ダーク", "Dark")}</button>
            </div>
            <button className="rp-secondary-button" type="button" onClick={props.onAutoOdds}><Zap size={19} />{props.t("オッズを再計算", "Recalculate odds")}</button>
            <p className="rp-auto-save"><Save size={16} />{props.t("変更は自動で保存されます", "Changes are saved automatically")}</p>
          </div>
        </section>
      )}

      {section === "players" && (
        <section className="rp-people-page">
          <div className="rp-page-heading compact"><h1>{props.t("参加者設定", "Bettor settings")}</h1><p>{props.t("予想してベットする人を追加・編集", "Add and edit people who place bets")}</p></div>
          <div className="rp-people-card">
            <header><h2>{props.t("ベッター", "Bettors")}</h2><p>{props.t("予想してベットする人", "People making predictions")}</p></header>
            <div className="rp-person-list">
              {props.room.players.map((player) => (
                <div className="rp-person-row" key={player.id}>
                  <IconSelect value={player.emoji} label={props.t(`${player.name}のアイコン`, `${player.name} icon`)} onChange={(emoji) => props.onPlayerEmojiChange(player.id, emoji)} />
                  <span><strong>{player.name}</strong><small>{player.isOffline ? props.t("代行参加", "Proxy") : props.t("本人参加", "Self")}</small></span>
                  <b>{currency.format(player.balance)}</b>
                  <button className="rp-delete-icon" type="button" onClick={() => props.onDeletePlayer(player.id)} aria-label={props.t("削除", "Delete")}><Trash2 size={21} /></button>
                </div>
              ))}
            </div>
            <details className="rp-add-disclosure">
              <summary><Plus size={20} />{props.t("追加", "Add")}</summary>
              <div className="rp-add-form">
                <IconSelect value={props.newPlayerEmoji} label={props.t("新しい参加者のアイコン", "New bettor icon")} onChange={props.setNewPlayerEmoji} />
                <input value={props.newPlayerName} onChange={(event) => props.setNewPlayerName(event.target.value)} placeholder={props.t("名前", "Name")} />
                <Toggle checked={props.newPlayerOffline} label={props.t("代行", "Proxy")} onChange={props.setNewPlayerOffline} />
                <button className="rp-primary-button" type="button" onClick={props.onAddPlayer}>{props.t("追加する", "Add bettor")}</button>
              </div>
            </details>
          </div>
          <div className="rp-bonus-card">
            <span><strong>{props.t("特別ボーナス", "Special bonus")}</strong><small>{props.t("順位ボーナスや救済を手動で付与", "Grant a manual reward or relief")}</small></span>
            <select value={props.bonusPlayerId} onChange={(event) => props.setBonusPlayerId(event.target.value)}>{props.room.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select>
            <input type="number" value={props.bonusAmount} onChange={(event) => props.setBonusAmount(Number(event.target.value))} />
            <button type="button" onClick={props.onGrantBonus}><Plus size={18} />{props.t("付与", "Grant")}</button>
          </div>
        </section>
      )}

      {section === "contestants" && (
        <section className="rp-people-page">
          <div className="rp-page-heading compact"><h1>{props.t("対戦者設定", "Racer settings")}</h1><p>{props.t("レースに出る人・CPUを追加・編集", "Add and edit racers and CPUs")}</p></div>
          <div className="rp-people-card rp-contestant-card">
            <header><h2>{props.t("対戦者", "Racers")}</h2><p>{props.t("レースに参加する人・CPU", "People and CPUs in the race")}</p></header>
            <div className="rp-contestant-head"><span></span><span></span><span>CPU</span><span>{props.t("レベル", "Level")}</span><span>{props.t("オッズ", "Odds")}</span><span></span></div>
            <div className="rp-contestant-list">
              {props.room.contestants.map((contestant) => (
                <div className="rp-contestant-row" key={contestant.id}>
                  <IconSelect value={contestant.icon} label={props.t(`${contestant.name}のアイコン`, `${contestant.name} icon`)} onChange={(icon) => props.onContestantLevelChange(contestant.id, { icon })} />
                  <strong>{contestant.name}</strong>
                  <Toggle checked={contestant.isCpu} label="" onChange={(checked) => props.onContestantLevelChange(contestant.id, { isCpu: checked })} />
                  <div className="rp-level-stepper">
                    <button type="button" onClick={() => props.onContestantLevelChange(contestant.id, { cpuLevel: Math.max(1, contestant.cpuLevel - 1) })}><Minus size={16} /></button>
                    <select value={contestant.cpuLevel} onChange={(event) => props.onContestantLevelChange(contestant.id, { cpuLevel: Number(event.target.value) })}>{levelChoices.map((level) => <option value={level} key={level}>{level}</option>)}</select>
                    <button type="button" onClick={() => props.onContestantLevelChange(contestant.id, { cpuLevel: Math.min(11, contestant.cpuLevel + 1) })}><Plus size={16} /></button>
                  </div>
                  <input className="rp-odds-input" type="number" min="1.01" step="0.01" value={contestant.odds} onChange={(event) => props.onOddsChange(contestant.id, Number(event.target.value))} />
                  <button className="rp-delete-icon" type="button" onClick={() => props.onDeleteContestant(contestant.id)} aria-label={props.t("削除", "Delete")}><Trash2 size={21} /></button>
                </div>
              ))}
            </div>
            <details className="rp-add-disclosure">
              <summary><Plus size={20} />{props.t("追加", "Add")}</summary>
              <div className="rp-add-form rp-add-contestant">
                <IconSelect value={props.newContestantEmoji} label={props.t("新しい対戦者のアイコン", "New racer icon")} onChange={props.setNewContestantEmoji} />
                <input value={props.newContestantName} onChange={(event) => props.setNewContestantName(event.target.value)} placeholder={props.t("対戦者名", "Racer name")} />
                <Toggle checked={props.newContestantIsCpu} label="CPU" onChange={props.setNewContestantIsCpu} />
                <select value={props.newContestantCpuLevel} onChange={(event) => props.setNewContestantCpuLevel(Number(event.target.value))}>{levelChoices.map((level) => <option value={level} key={level}>Lv {level}</option>)}</select>
                <input type="number" min="1.01" step="0.01" value={props.newContestantOdds} onChange={(event) => props.setNewContestantOdds(Number(event.target.value))} />
                <button className="rp-primary-button" type="button" onClick={props.onAddContestant}>{props.t("追加する", "Add racer")}</button>
              </div>
            </details>
          </div>
          <div className="rp-info-banner"><Info size={22} />{props.t("CPUレベルは1〜11。レベル変更時はオッズを自動調整します。", "CPU levels range from 1 to 11. Odds update with level changes.")}</div>
        </section>
      )}
    </div>
  );
}

function RankBadge(props: { rank: number }) {
  return <span className={`rp-rank-badge rank-${props.rank}`}>{props.rank}</span>;
}

function formatHistoryPick(room: Room, bet: RaceBetResult, historyContestants: NonNullable<Room["raceHistory"][number]["contestants"]>) {
  return bet.contestantIds.map((id) => historyContestants.find((item) => item.id === id)?.name ?? getContestant(room, id)?.name ?? "-").join(" - ");
}

export function RankRankingView(props: {
  room: Room;
  ranking: Player[];
  displayMode: ResultDisplayMode;
  setDisplayMode: (value: ResultDisplayMode) => void;
  betTypeLabels: Record<BetType, { title: string; note: string }>;
  onNextRace: () => void;
  t: Translate;
}) {
  const latest = props.room.raceHistory.at(-1);
  const historyContestants = latest?.contestants ?? props.room.contestants;
  const ranking = useMemo(() => rankedPlayers(props.room.players), [props.room.players]);
  const podium = [
    ranking[1] ? { player: ranking[1], rank: 2 } : undefined,
    ranking[0] ? { player: ranking[0], rank: 1 } : undefined,
    ranking[2] ? { player: ranking[2], rank: 3 } : undefined,
  ].filter((entry): entry is { player: Player; rank: number } => Boolean(entry));

  const shareResult = async () => {
    const text = `${props.room.name}\n${ranking.map((player, index) => `${index + 1}. ${player.name} ${currency.format(player.balance)}`).join("\n")}`;
    if (navigator.share) {
      await navigator.share({ title: props.room.name, text });
    } else {
      await navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="rp-screen rp-ranking-screen">
      <div className="rp-result-tabs">
        <button className={props.displayMode === "ranking" ? "active" : ""} type="button" onClick={() => props.setDisplayMode("ranking")}>{props.t("ランキング", "Ranking")}</button>
        <button className={props.displayMode === "payouts" ? "active" : ""} type="button" onClick={() => props.setDisplayMode("payouts")}>{props.t("払戻表", "Payouts")}</button>
      </div>

      {props.displayMode === "ranking" ? (
        <>
          <div className="rp-ranking-context">
            <span><Trophy size={19} />{props.t(`第${Math.max(1, props.room.raceHistory.length)}レース時点`, `After race ${Math.max(1, props.room.raceHistory.length)}`)}</span>
            <small>{props.room.currentRace.status === "settled" ? props.t("確定", "Settled") : props.t("リアルタイム更新", "Live update")}</small>
          </div>
          {ranking.length === 0 ? (
            <section className="rp-empty-ranking"><Crown size={32} /><strong>{props.t("参加者待ちです", "Waiting for players")}</strong><p>{props.t("参加者が入るとランキングが表示されます", "Ranking appears when players join")}</p></section>
          ) : (
            <>
              <section className="rp-podium">
                {podium.map(({ player, rank }) => (
                  <article className={`rp-podium-card rank-${rank}`} key={player.id}>
                    <RankBadge rank={rank} />
                    <span className="rp-podium-avatar" style={{ "--accent": player.accent } as CSSProperties}>{player.emoji}</span>
                    <strong>{player.name}</strong>
                    <em>{player.isOffline ? props.t("代行参加", "Proxy") : props.t("本人参加", "Self")}</em>
                    <small>{props.t("獲得予想ポイント", "Current points")}</small>
                    <b>{currency.format(player.balance)}<i>pt</i></b>
                  </article>
                ))}
              </section>
              <section className="rp-ranking-list">
                <header><span>{props.t("順位", "Rank")}</span><span>{props.t("ユーザー", "User")}</span><span>{props.t("獲得予想ポイント", "Points")}</span></header>
                {ranking.slice(3).map((player, index) => (
                  <div className="rp-ranking-row" key={player.id}>
                    <b>{index + 4}</b>
                    <span className="rp-list-avatar" style={{ "--accent": player.accent } as CSSProperties}>{player.emoji}</span>
                    <strong>{player.name}</strong>
                    <em>{player.isOffline ? props.t("代行参加", "Proxy") : props.t("本人参加", "Self")}</em>
                    <span>{currency.format(player.balance)} pt</span>
                    <ChevronRight size={19} />
                  </div>
                ))}
              </section>
              <p className="rp-ranking-footer">{props.t("参加者", "Players")}：<b>{ranking.length}{props.t("人", "")}</b></p>
            </>
          )}
        </>
      ) : (
        <section className="rp-results-screen">
          <header className="rp-results-title">
            <button className="rp-icon-button" type="button" onClick={() => props.setDisplayMode("ranking")} aria-label={props.t("戻る", "Back")}><ArrowLeft size={24} /></button>
            <span><Flag size={21} /></span>
            <h1>{props.t("レース結果", "Race results")}</h1>
          </header>
          {latest ? (
            <>
              <div className="rp-race-summary">
                <span><small>{props.t("レース", "Race")}</small><strong>{latest.raceTitle}</strong></span>
                <span><small>{props.t("参加人数", "Bettors")}</small><strong>{props.room.players.length}{props.t("人", "")}</strong></span>
                <span><small>{props.t("総ベット", "Total stake")}</small><strong>{currency.format(latest.payouts.reduce((sum, item) => sum + item.stake, 0))}</strong></span>
                <em>{props.t("確定", "Settled")}</em>
              </div>
              <div className="rp-finish-order">
                {latest.resultIds.slice(0, 3).map((id, index) => {
                  const contestant = historyContestants.find((item) => item.id === id);
                  return (
                    <div key={id}><RankBadge rank={index + 1} /><b>{index + 1}{props.t("着", "")}</b><span className="rp-lane-number" style={{ "--lane": contestant?.accent ?? "#ffbe00" } as CSSProperties}>{historyContestants.findIndex((item) => item.id === id) + 1}</span><strong>{contestant?.name ?? "-"}</strong><em>{contestant?.odds.toFixed(2)}x</em></div>
                  );
                })}
              </div>
              <div className="rp-odds-strip">
                <strong>{props.t("今回のオッズ", "Odds")}</strong>
                {historyContestants.map((contestant, index) => <span key={contestant.id}><b style={{ "--lane": contestant.accent } as CSSProperties}>{index + 1}</b><small>{contestant.odds.toFixed(2)}</small></span>)}
              </div>
              <div className="rp-bet-result-tabs"><strong>{props.t("ベット一覧", "Bet list")}</strong><span>{props.t("払戻し詳細", "Payout details")}</span></div>
              <div className="rp-result-table">
                <header><span>{props.t("プレイヤー", "Player")}</span><span>{props.t("ベット内容", "Ticket")}</span><span>{props.t("結果", "Result")}</span><span>{props.t("払戻", "Payout")}</span><span>{props.t("収支", "Delta")}</span></header>
                {(latest.bets ?? []).length === 0 ? (
                  <p>{props.t("このレースのベットはありません", "No bets in this race")}</p>
                ) : (latest.bets ?? []).map((bet, index) => {
                  const player = props.room.players.find((item) => item.id === bet.playerId);
                  return (
                    <div className={bet.hit ? "hit" : "miss"} key={bet.id}>
                      <RankBadge rank={Math.min(9, index + 1)} />
                      <span className="rp-list-avatar" style={{ "--accent": player?.accent ?? "#ddd" } as CSSProperties}>{player?.emoji ?? "?"}</span>
                      <span className="rp-result-player"><strong>{player?.name ?? "-"}</strong><small>{bet.placedBy === "host" ? props.t("代行", "Proxy") : props.t("本人", "Self")}</small></span>
                      <span className="rp-result-pick"><strong>{formatHistoryPick(props.room, bet, historyContestants)}</strong><small>{props.betTypeLabels[bet.type].title} / {currency.format(bet.amount)}</small></span>
                      <span className="rp-hit-label">{bet.hit ? props.t("○ 的中", "Hit") : props.t("× 不的中", "Miss")}</span>
                      <span>{currency.format(bet.payout)}</span>
                      <b>{bet.delta >= 0 ? "+" : ""}{currency.format(bet.delta)}</b>
                    </div>
                  );
                })}
              </div>
              <div className="rp-payout-total">
                <span><small>{props.t("総ベット", "Stake")}</small><strong>{currency.format(latest.payouts.reduce((sum, item) => sum + item.stake, 0))}</strong></span>
                <span><small>{props.t("払戻", "Payout")}</small><strong>{currency.format(latest.payouts.reduce((sum, item) => sum + item.payout, 0))}</strong></span>
                <span><small>{props.t("収支", "Delta")}</small><strong>{currency.format(latest.payouts.reduce((sum, item) => sum + item.delta, 0))}</strong></span>
              </div>
              <div className="rp-result-actions">
                <button className="rp-secondary-button" type="button" onClick={shareResult}><Share2 size={19} />{props.t("結果をシェア", "Share results")}</button>
                <button className="rp-primary-button" type="button" onClick={props.onNextRace} disabled={props.room.currentRace.status !== "settled"}>{props.t("新しいレースを開始", "Start next race")}</button>
              </div>
            </>
          ) : (
            <div className="rp-empty-ranking"><Medal size={30} /><strong>{props.t("確定した結果はまだありません", "No settled result yet")}</strong><p>{props.t("結果を確定すると、払戻しと投票結果がここに表示されます", "Settle a race to see payouts and tickets")}</p></div>
          )}
        </section>
      )}
    </div>
  );
}

function pointerPosition(event: ReactPointerEvent<HTMLElement>, count: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(count - 1, ((event.clientX - rect.left) / Math.max(rect.width, 1)) * count - 0.5));
}

export function RankBottomNav(props: { active: RankTabKey; role: "host" | "player"; onChange: (tab: RankTabKey) => void; t: Translate }) {
  const items: Array<{ key: RankTabKey; label: string; icon: ReactNode; hostOnly?: boolean }> = [
    { key: "home", label: props.t("ホーム", "Home"), icon: <Home size={23} /> },
    { key: "bet", label: props.t("ベット", "Bet"), icon: <Zap size={23} /> },
    { key: "host", label: props.t("管理", "Host"), icon: <Settings2 size={23} />, hostOnly: true },
    { key: "ranking", label: props.t("順位", "Ranks"), icon: <Crown size={23} /> },
  ];
  const visible = items.filter((item) => props.role === "host" || !item.hostOnly);
  const activeIndex = Math.max(0, visible.findIndex((item) => item.key === props.active));
  const [drag, setDrag] = useState<number | null>(null);
  const style = { "--nav-count": visible.length, "--nav-position": drag ?? activeIndex } as CSSProperties;
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    const position = pointerPosition(event, visible.length);
    setDrag(position);
    const next = visible[Math.round(position)];
    if (next && next.key !== props.active) props.onChange(next.key);
  };
  const finish = (event?: ReactPointerEvent<HTMLElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  };

  return (
    <nav
      className={drag === null ? "rp-bottom-nav" : "rp-bottom-nav dragging"}
      style={style}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={(event) => { if (event.buttons === 1) move(event); }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      aria-label={props.t("メインナビゲーション", "Main navigation")}
    >
      {visible.map((item) => (
        <button className={props.active === item.key ? "active" : ""} type="button" key={item.key} onClick={() => props.onChange(item.key)}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
