# Discord issue bot

The Discord issue bot makes a GitHub issue in this repository from a bug report on the project's Discord server. It is not part of the app: it is a Cloudflare Worker in `discord/`, and `.oxlintrc.json` forbids it any import from `src/`.

## What it does

- **On a thread or a forum post.** Type `/issue` in the thread. The bot reads the first message of the thread (for a thread made from a channel message, that message). Set `replies` to `True` to put the thread's replies in the issue as well, as quotes (at most 50).
- **On one message.** Right-click the message (long-press on a phone) and select **Apps → Create GitHub issue**.

Both commands open the same form: a title, the type and the report text. The type is the issue template's label: `bug` (App bug), `rules` (Rules or card bug) or `accessibility` (Accessibility barrier). You can change each field. When you submit, the bot:

1. Creates the issue in `GITHUB_REPO` (`discord/wrangler.toml`) with the label.
2. Adds the report's attachments as links, the reporter's Discord name, a link to the Discord message or thread, and your name.
3. Replies to the report (or posts in the thread) with the issue link.
4. Tells you, in a message only you see, that it created the issue or why it could not.

Discord attachment links expire after about a day. To keep a screenshot, open the issue and drag the picture into a comment.

The issue is public. The reporter's Discord display name and text go into it. Say this in the bug channel's rules.

## How it works

Discord sends each command to the Worker's URL (the Interactions Endpoint URL). The Worker checks Discord's Ed25519 signature (`discord/verify.ts`), reads the report through the Discord API as the bot (`discord/source.ts`), answers with the form, and on submit creates the issue through the GitHub API (`discord/issue.ts`). `discord/worker.ts` routes the interactions. The Worker needs no server that runs all the time and no database. `discord/commands.json` holds the two command definitions that you register with Discord. `discord/worker.test.ts` tests the bot with `pnpm vitest run discord`.

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
4. Set an expiry date and write it in your calendar. When the token expires, the bot tells you "GitHub answered 401". Make a new token and do step 3 of Deploy the Worker again for `GITHUB_TOKEN`.
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

   The secrets stay in Cloudflare. Do not write them in `wrangler.toml` or commit them.

### Connect Discord to the Worker

1. In the Developer Portal, on **General Information**, paste the Worker's URL into **Interactions Endpoint URL** and select **Save Changes**.
2. Discord sends a test request to the URL. If Discord shows an error, the public key secret is wrong or the Worker did not deploy: see Find a problem.

### Register the commands

Run this in the `discord` folder. `read -s` keeps the token out of your shell history:

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
https://discord.com/oauth2/authorize?client_id=<your application id>&scope=bot+applications.commands&permissions=274877975552
```

The permissions number gives the bot View Channels, Send Messages, Send Messages in Threads and Read Message History, and nothing more. If a bug channel limits who can see it, give the bot's role access to that channel too.

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
- **"I cannot read that report".** The bot cannot see the channel, or **Message Content Intent** is off.
- **"GitHub answered 401" or "403".** The GitHub token expired or has no Issues write permission for this repository.
- **"GitHub answered 422".** The title is not valid, or a label is missing: the repository must have the labels `bug`, `rules` and `accessibility`.
- **"I could not post the link in the channel".** The bot has no Send Messages permission (or Send Messages in Threads) in that channel. The issue was still created.

## Change it

- **Code.** Change the files in `discord/`, run `pnpm vitest run discord`, `pnpm lint` and `pnpm typecheck`, then `npx wrangler deploy` in the `discord` folder.
- **Commands.** Change `discord/commands.json` and run Register the commands again.
- **Repository.** Change `GITHUB_REPO` in `discord/wrangler.toml`, make a token for that repository and deploy again.
