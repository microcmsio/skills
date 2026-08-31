---
name: microcms-<name>
description: <何をするスキルか>。<いつ使うか。トリガーになるキーワードを具体的に列挙する>。<いつ使わないか。他スキルとの境界を書く。例: 既存 API の仕様確認は microcms-docs を使う>
license: MIT
---

<!--
  フロントマターは Agent Skills 規格の 6 フィールドのみを使う。
  （name / description / license / compatibility / metadata / allowed-tools）
  Claude Code 専用フィールドは他エージェントで無視され、claude.ai へのアップロード時はエラーになる。

  name はディレクトリ名と一致させること（microcms- プレフィックス必須）。
  description は 1024 文字以内。エージェントは起動時にこれだけを読んでトリガー判定する。
-->

# <スキル名>

## 概要

<このスキルが何を解決するかを 1〜3 行で>

## ワークフロー

### 1. <最初にやること>

<判断や分類の手順>

### 2. <次にやること>

<参照ファイルがあれば references/ を読ませる。URL やパラメータを推測で生成させない>

### 3. 回答の生成

- 出典を必ず明示する
- ドキュメントに記載がない事項は「明示されていない」と伝える

## 重要な注意事項

<!-- AI が間違えがちな点、社内でしか知らない仕様をここに書く。汎用知識は書かない -->

1. <例: 認証は X-MICROCMS-API-KEY ヘッダー。旧 X-API-KEY は非推奨>

## リソース

- `references/<file>.md`: <内容>

<!--
  本文にツール固有名（WebFetch / AskUserQuestion など）を書かないこと。
  「Web 取得ツール」「ユーザーに確認する」のようなツール非依存の表現にする。
  本体が 500 行を超えたら references/ に切り出す。
-->
