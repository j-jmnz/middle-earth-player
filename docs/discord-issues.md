# Discord issue bot

The Discord issue bot makes a GitHub issue in this repository from a bug report on the project's Discord server. It is not part of the app: it is a Cloudflare Worker in `discord/`, and `.oxlintrc.json` forbids it any import from `src/`.

## What it does

- **On a thread or a forum post.** Type `/issue` in the thread. The bot reads the first message of the thread (for a thread made from a channel message, that message). Set `replies` to `True` to put the thread's replies in the issue as well, as quotes (at most 50).
- **On one message.** Right-click the message (long-press on a phone) and select **Apps → Create GitHub issue**.

Both commands open the same form: a title, the type and the report text. The type is the issue template's label: `bug` (App bug), `rules` (Rules or card bug) or `accessibility` (Accessibility barrier). You can change each field. When you submit, the bot:

1. Creates the issue in `GITHUB_REPO` (`discord/wrangler.toml`) with the label.
2. Adds the report's attachments as links, the reporter's Discord name, a link to the Discord message or thread, and your name.
3. Starts a thread on the report message, named for the issue (`#42 Gandalf costs 5`), and thanks the reporter there with the issue link. For `/issue`, it posts in the thread that you ran it in.
4. Tells you, in a message only you see, that it created the issue or why it could not.

## Issue updates

After that, the bot posts each change of the issue in the same thread. If the thread is archived, the post opens it again. When the bot cannot start a thread (the report message is already inside a thread or a forum post, or the bot has no Create Public Threads permission), it replies to the report message.

| GitHub event | Message in Discord |
| --- | --- |
| Issue closed as completed by a person | 🎉 The issue is fixed and will be in the next app update. The release workflow closes the issues a release settles; that close posts nothing, since the release post covers it. |
| Issue closed as not planned, or as a duplicate | The issue is closed, and where to read why. |
| Issue reopened | The issue is reopened for another look. |
| A person comments on the issue | 💬 Who replied, the comment's first 600 characters as a quote, and a link. Comments from bots are not posted. |
| A release is published | 🚀 For each issue that the release notes settle (`closes #n`), the version that has the fix. A prerelease posts nothing. This is the last post for that issue. |

The bot's messages do not ping anyone. The bot only follows issues that it made: each one keeps its Discord place in a hidden comment at the end of the issue body (`<!-- discord issue:… -->`). Do not delete that line when you edit the issue. If the report message or thread is deleted, the bot skips the update.

After the release post, the bot stops following the issue: it changes the hidden line to `<!-- discord released issue:… -->`, so a later comment, close or reopen posts nothing in Discord. To follow the issue again (for example, after a regression), change the line back to `<!-- discord issue:… -->`.

Discord attachment links expire after about a day. To keep a screenshot, open the issue and drag the picture into a comment.

The issue is public. The reporter's Discord display name and text go into it. Say this in the bug channel's rules.

## Release announcements

When the release workflow publishes a release, the bot posts an announcement to the releases channel: one embed titled "Middle-Earth Player v0.4.0 is out!" that links to the release page. The bot builds it from the release notes:

- It keeps the sections that players read: **Before you update**, **New**, **Fixes** and **Look and feel**, each with at most 12 lines and "…and N more on GitHub" for the rest.
- It counts **Under the hood** and **Project** in one line ("Plus 3 behind-the-scenes changes…").
- It drops issue numbers, install steps and checksums, and ends with a short **How to update** part. The release page keeps all of it.

A prerelease is not announced. If you set a role, the announcement mentions it, so players who want a ping can take that role. `discord/release.ts` builds the announcement, and `discord/release.test.ts` tests it against notes that `scripts/release/notes.ts` writes.

## How it works

Discord sends each command to the Worker's URL (the Interactions Endpoint URL). The Worker checks Discord's Ed25519 signature (`discord/verify.ts`), reads the report through the Discord API as the bot (`discord/source.ts`), answers with the form, and on submit creates the issue through the GitHub API (`discord/issue.ts`). `discord/worker.ts` routes the interactions. GitHub's webhook calls the Worker at `/github`; `discord/github.ts` checks GitHub's signature and posts the issue updates. The Worker needs no server that runs all the time and no database. `discord/commands.json` holds the two command definitions that you register with Discord. `discord/worker.test.ts` and `discord/github.test.ts` test the bot with `pnpm vitest run discord`.

## Set it up

You need a Cloudflare account with Workers (`workers.dev` subdomain set), admin rights on the Discord server and admin rights on the GitHub repository. Do the steps in this order.

### Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select **New Application**. Name it, for example `Middle-earth Issues`.
2. On **General Information**, copy the **Application ID** and the **Public Key**. You use them in Deploy the Worker.
3. On **Bot**:
   - Select **Reset Token** and copy the token. Discord shows it one time only. Keep it secret.
   - Turn on **Message Content Intent** (under Privileged Gateway Intents). Without it, the bot reads empty messages.
   - Turn off **Public Bot**, so only you can add the bot to a server.
4. On **Installation**, set **Install Link** to **None**. You add the bot with the link in Add the bot to the server.

### Create the GitHub token

1. On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens** and select **Generate new token**.
2. Set **Resource owner** to the repository's owner and **Repository access** to **Only select repositories**: `middle-earth-player`.
3. Under **Repository permissions**, set **Issues** to **Read and write**. GitHub adds **Metadata: Read-only** itself. Give no other permission.
4. Set an expiry date and write it in your calendar. When the token expires, the bot tells you "the GitHub token has expired or is wrong". Make a new token and do step 3 of Deploy the Worker again for `GITHUB_TOKEN`.
5. Copy the token.

The issues show your GitHub account as their author, because the token is yours. To show a bot account instead, make the token on a second GitHub account that has write access to the repository.

### Deploy the Worker

Run these commands on your computer, in a clone of this repository.

1. Go to the bot's folder and log in to Cloudflare (if Wrangler is not logged in yet):

   ```sh
   cd discord
   npx wrangler login
   ```

2. Deploy:

   ```sh
   npx wrangler deploy
   ```

   Wrangler prints the Worker's URL, for example `https://middle-earth-issues.<your-subdomain>.workers.dev`. Copy it. If your Cloudflare login has more than one account, Wrangler asks which one to use.

3. Add the four secrets. Each command asks for the value; paste it and push Enter:

   ```sh
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put DISCORD_APPLICATION_ID
   npx wrangler secret put DISCORD_BOT_TOKEN
   npx wrangler secret put GITHUB_TOKEN
   ```

   The fifth secret, `GITHUB_WEBHOOK_SECRET`, is in Connect GitHub to the Worker.

   The secrets stay in Cloudflare. Do not write them in `wrangler.toml` or commit them.

### Connect Discord to the Worker

1. In the Developer Portal, on **General Information**, paste the Worker's URL into **Interactions Endpoint URL** and select **Save Changes**.
2. Discord sends a test request to the URL. If Discord shows an error, the public key secret is wrong or the Worker did not deploy: see Find a problem.

### Connect GitHub to the Worker

This step turns on Issue updates.

1. Make a random secret and copy it:

   ```sh
   openssl rand -hex 32
   ```

2. In the `discord` folder, run `npx wrangler secret put GITHUB_WEBHOOK_SECRET` and paste the secret.
3. On GitHub, open the repository's **Settings → Webhooks → Add webhook** and fill in:
   - **Payload URL**: the Worker's URL with `/github` at the end, for example `https://middle-earth-issues.<your-subdomain>.workers.dev/github`.
   - **Content type**: `application/json`. The bot cannot read the other type.
   - **Secret**: the same secret.
   - **Which events**: **Let me select individual events**. Select **Issues**, **Issue comments** and **Releases**, and clear **Pushes**.
4. Select **Add webhook**. GitHub sends a test delivery. Under **Recent Deliveries**, it must show a green tick and the answer `Nothing to post.`

### Set the releases channel

This step turns on Release announcements.

1. In Discord, open **User Settings → Advanced** and turn on **Developer Mode**.
2. Right-click the releases channel and select **Copy Channel ID**.
3. In the `discord` folder, run `npx wrangler secret put RELEASES_CHANNEL_ID` and paste the ID.
4. To ping a role with each announcement (optional), open **Server Settings → Roles**, right-click the role, select **Copy Role ID**, and run `npx wrangler secret put RELEASES_ROLE_ID` with it. Make sure that the role is mentionable, or that the bot has **Mention @everyone, @here, and All Roles** in that channel.
5. Give the bot **View Channel**, **Send Messages** and **Embed Links** in the releases channel. If the channel is an announcement channel that only some roles can post in, add the bot to those roles or give it the permissions in the channel's settings.
6. If a GitHub webhook already posts releases to that channel, remove it (**Server Settings → Integrations → Webhooks**), or the channel gets two posts for each release.

### Register the commands

Run this in the `discord` folder. `read -s` keeps the token out of your shell history. This is the bash form; in zsh (the macOS default) the first line is `read -s "BOT_TOKEN?Bot token: "; echo`:

```sh
read -s -p "Bot token: " BOT_TOKEN; echo
APP_ID=<your application id>
curl -X PUT "https://discord.com/api/v10/applications/$APP_ID/commands" \
  -H "Authorization: Bot $BOT_TOKEN" \
  -H "Content-Type: application/json" \
  --data @commands.json
```

Discord answers with the two commands as JSON. Run the same command again after you change `commands.json`. Global commands can take some minutes to show in the Discord app; restart the app if they do not show.

### Add the bot to the server

Open this link with your application ID in it, select the server and select **Authorize**:

```
https://discord.com/oauth2/authorize?client_id=<your application id>&scope=bot+applications.commands&permissions=309237730304
```

The permissions number gives the bot View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Embed Links and Read Message History, and nothing more. If you added the bot with an earlier link that did not have Create Public Threads, open the new link again and select **Authorize**, or give the bot's role that permission in **Server Settings → Roles**. If a bug channel limits who can see it, give the bot's role access to that channel too.

### Choose who can use it

The commands are for members with the **Manage Messages** permission (`default_member_permissions` in `commands.json`). To give them to a role instead, open **Server Settings → Integrations**, select the bot, and set the two commands to that role. Do not give them to everyone: each use makes a public issue.

## Use it

1. Find the report in Discord.
2. In its thread or forum post, type `/issue`. For one message, right-click it and select **Apps → Create GitHub issue**.
3. Check the title, select the type and edit the text. Remove anything that is not part of the bug.
4. Select **Submit**. The bot replies with the issue link.

## Find a problem

- **See the Worker's log.** In the `discord` folder, run `npx wrangler tail`, then use the command again. The Cloudflare dashboard also shows the log under **Workers & Pages → middle-earth-issues → Logs**.
- **Discord refuses the Interactions Endpoint URL.** The `DISCORD_PUBLIC_KEY` secret does not match the application's Public Key, or the URL is wrong. Put the secret again and save the URL again.
- **"This interaction failed".** The Worker did not answer in three seconds or gave an error. See the log.
- **"I couldn't read that message".** The bot cannot see the channel, or **Message Content Intent** is off.
- **"The GitHub token has expired or is wrong", or "isn't allowed to create issues".** The GitHub token expired or has no Issues write permission for this repository.
- **"GitHub didn't accept the title or a label".** The title is not valid, or a label is missing: the repository must have the labels `bug`, `rules` and `accessibility`.
- **"Something went wrong on my side" or another GitHub error.** Run `npx wrangler tail` and try again: the log has the full error.
- **No issue update in Discord.** On GitHub, open **Settings → Webhooks**, select the webhook and read **Recent Deliveries**. `401` means that `GITHUB_WEBHOOK_SECRET` and the webhook's secret are different. `500` shows the error: for example, the bot cannot post in that channel. `Nothing to post.` means that the bot did not make that issue, the marker line was deleted, or the event is not one in Issue updates. You can send a failed delivery again with **Redeliver**.
- **No release announcement.** The `RELEASES_CHANNEL_ID` secret is not set or names another channel, the bot cannot post or embed links in that channel, or the release is a prerelease. The release delivery in **Recent Deliveries** says "Announced the release…" when the bot posted it, and shows the error when it failed. If you send a failed release delivery again, the reports that already got their release post get it a second time.
- **"I couldn't post in that channel".** The bot has no Send Messages permission (or Send Messages in Threads) in that channel. The issue was still created.
- **The bot replies to the message instead of starting a thread.** The bot has no Create Public Threads permission in that channel, or the message is already in a thread.

## Change it

- **Code.** Change the files in `discord/`, run `pnpm vitest run discord`, `pnpm lint` and `pnpm typecheck`, then `npx wrangler deploy` in the `discord` folder.
- **Commands.** Change `discord/commands.json` and run Register the commands again.
- **Repository.** Change `GITHUB_REPO` in `discord/wrangler.toml`, make a token for that repository and deploy again.
