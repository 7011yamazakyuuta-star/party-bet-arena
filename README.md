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

## Realtime Database Rules

公開用ルールの正本は `firebase.rules.json` です。GitHub Pages のデプロイでは Firebase ルールは更新されません。Firebase Console に反映する前に、ルールテストと既存ルームの互換性を確認してください。ホストだけがルーム全体を管理でき、参加者は招待コードで登録した後、自分の参加者レコードを一度作成し、自分の BET を受付中に一度作成できます。

検証コマンド:

```sh
npm run test:security
npm run test:rules:emulator
npm audit --omit=dev --audit-level=high
```

本番へ書き込まずにブラウザで結合確認する場合は、`.env.local` に以下の**エミュレータ専用**設定を入れ、別々のターミナルで `npm run dev:emulators` と `npm run dev` を起動します。`VITE_USE_FIREBASE_EMULATORS` は開発サーバーでのみ有効です。

```dotenv
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_APP_ID=1:123:web:123
VITE_FIREBASE_AUTH_DOMAIN=demo-party-bet-security.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://demo-party-bet-security-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=demo-party-bet-security
VITE_USE_FIREBASE_EMULATORS=true
```

オンラインルーム全体のローカルキャッシュは、Firebaseへの保存・同期が確認できた後に削除します。保存済みルーム一覧にはIDと表示用情報だけを残し、参加コードは削除します。通信障害中は未同期データを失わないよう、全体キャッシュが残る場合があります。共有端末ではFirebaseの匿名ログイン状態も別途残るため、端末自体の管理が必要です。

クライアントとルールは同じ変更として公開し、新しいサイトのデプロイを確認してからFirebaseルールを公開してください。先にルールだけ切り替えると旧クライアントの参加・BET書き込みが拒否されます。ルールを本番へ反映した後、新規ルームの作成、招待参加、BET、結果確定を実機ブラウザで確認してください。

既存の短い参加コードは推測されやすいため、新しいルームを作り、招待リンクを更新してください。匿名認証を使う限り、端末を変えたりブラウザデータを消したりするとホスト権限を復元できません。

このルールでも、匿名認証は「端末ごとの簡易ID」です。管理者用の強い本人確認が必要な規模にする場合は、Googleログインなどの明示ログインを追加してください。

旧ルールで作成したテストルームは`hostUid`や`uid`が入っていない場合があります。本格公開用ルールへ切り替えた後は、新しくルームを作り直して動作確認してください。

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
