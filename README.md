# Party Bet Arena

身内で遊ぶための汎用ベッティング＆ランキングWebアプリです。競馬風のBET体験を、スマブラ、マリオカート、カラオケ、ボードゲームなどの勝負に転用できます。

> 注意: このアプリはゲーム内コインだけを扱う身内向けツールです。現金、換金、賞品、賭博性のある運用には使わないでください。

## できること

- ルーム作成、Room ID、参加コード発行
- 公開URL、Room ID、参加コードを共有して各スマホから参加
- ホストモードとプレイヤーモード
- ホストによる代行BET入力
- 競走対象ごとの手動オッズ設定
- 単勝、複勝BET
- 2連単、3連単BET
- 所持コインを超えるBETの防止
- BET状況ダッシュボード
- 結果入力と自動配当計算
- リアルタイムランキング
- 破産者表示、大穴的中エフェクト
- 賭ける人、競走プレイヤーをそれぞれ最大8人までに制限
- CPU Lv 1-9、強さ1-9に基づくオッズ自動調整
- 日本語 / 英語の表示切替
- 参加者、対戦者の絵文字アイコン選択
- `パーティ` / `ガーデン` / `キャンディ` / `スカイ` / `ネオン` / `ポップ` / `ミニマル` のデザイン切替

## 使い方

1. ホストが公開URLを開き、`本番ルーム` を押します。
2. 画面に表示されたURL、Room ID、参加コードを友だちへ共有します。
3. 友だちは同じURLを開き、右上のゲストアイコンから名前、Room ID、参加コードを入力します。
4. スマホを使わない人は、ホストの `BET` 画面で `幹事代行入力` から代理BETできます。
5. ホストが `管理` 画面で結果を入力すると、ランキングが更新されます。

右上の `JP` / `EN` ボタンで、その端末だけ表示言語を切り替えできます。テーマは `管理` 画面で説明付きカードから選べます。

初期表示の `カラオケ対決` や `DEMO42` は操作確認用のデモです。本番利用時は `本番ルーム` を作成して、管理画面の `勝負名` を変更してください。

## 技術構成

- React + TypeScript + Vite
- Firebase Realtime Database optional sync
- GitHub Pages hosting
- iPhone縦向き優先のSPA

Firebase設定がない場合は、ブラウザのlocalStorageを使うローカルデモとして動作します。

## セットアップ

```bash
npm install
npm run dev
```

PowerShellで`npm`が実行ポリシーに止められる場合は、Windowsの実体コマンドを使います。

```bash
npm.cmd install
npm.cmd run dev
```

## Firebase設定

このリポジトリはpublic前提です。Firebaseの実値や`.env.local`はコミットしないでください。

1. Firebase ConsoleでWebアプリを追加
2. `.env.example`を参考に、ローカルだけに`.env.local`を作成
3. `VITE_FIREBASE_*`にFirebase Web configの値を入れる

```bash
cp .env.example .env.local
```

`.env.local`は`.gitignore`で除外されています。

Firebase Web configの`apiKey`はブラウザに配布される前提の識別子ですが、Database Rulesが本体の防御です。管理者用のサービスアカウント鍵はこのアプリでは使いません。

## Realtime Database Rulesの初期案

開発中のテストモードは公開前に必ず解除してください。最初の身内テスト用には、少なくとも匿名認証済みユーザーだけに制限します。

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['id', 'name', 'joinCode', 'players', 'contestants', 'currentRace'])"
      }
    }
  }
}
```

このルールはMVP用です。Room IDを知る匿名ユーザーが同じルームを操作できる前提なので、公開範囲を広げる前に、ホスト権限、参加者権限、招待コード検証をさらに厳密化してください。

## GitHub Pages

このリポジトリにはGitHub Pages向けのActions workflowを含めています。

GitHubでの設定:

1. Repository `Settings`
2. `Pages`
3. `Build and deployment`
4. Sourceを `GitHub Actions` にする
5. `main`へpushすると自動デプロイ

Firebase configをGitHub Pages上でも有効にする場合は、GitHubのRepository secretsではなく、Repository variablesで`VITE_FIREBASE_*`を設定する運用がおすすめです。値は公開バンドルに含まれるため、秘密情報は入れないでください。

## 開発メモ

- コインはゲーム内ポイントとして扱います。
- BET時点ではコインを予約し、結果確定時に元本を差し引いて配当を加算します。
- 複勝は3着以内を的中扱いにし、倍率は単勝オッズの約52%で計算します。
- 2連単は1着・2着、3連単は1着・2着・3着の順番が完全一致した場合に的中します。
- 自動オッズは簡易モデルです。CPU Lvまたは強さが高い対象ほど低倍率、低い対象ほど高倍率に寄せます。
- ルームパスワードや参加コードは身内の簡易制御用であり、強固な認証ではありません。
