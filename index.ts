import { App, Block } from '@slack/bolt'
import { execSync, exec } from 'child_process'
import { connection, server as WebSocketServer } from 'websocket'
import { config } from 'dotenv'
import http from 'http'
import fs from 'fs'

config()

const app = new App({
  signingSecret: process.env.SIGNING_SECRET,
  token: process.env.BOT_TOKEN,
  socketMode: true,
  appToken: process.env.APP_TOKEN,
})

const GAME_INPUT_MAP = {
  UP: 'Up',
  DOWN: 'Down',
  LEFT: 'Left',
  RIGHT: 'Right',
  A: 'Z',
  B: 'X',
  START: 'Enter',
  SELECT: 'Backspace',
}

let connections: connection[] = []
let chain = Promise.resolve()

for (const [gameInput, keyEvent] of Object.entries(GAME_INPUT_MAP)) {
  app.action(`GAME_INPUT_${gameInput}`, async (action) => {
    const vbamWindow = execSync('xdotool search --class vbam')
      .toString()
      .split('\n')[0]

    await action.ack()
    const username =
      'username' in action.body.user ? action.body.user.username : 'unknown'

    fs.appendFile(
      './inputs.log',
      JSON.stringify({
        date: new Date(),
        username,
        input: gameInput,
      }) + '\n',
      () => {}
    )

    for (const connection of connections) {
      connection.send(
        JSON.stringify({
          username,
          input: gameInput,
        })
      )
    }

    chain = chain.then(
      () =>
        new Promise((resolve) => {
          exec(
            `xdotool key --clearmodifiers --delay 100 --window ${vbamWindow} ${keyEvent}`,
            (err, stdout, stderr) => {
              if (err) {
                console.error(err)
              }

              if (stderr) {
                console.error(stderr)
              }

              resolve()
            }
          )
        })
    )
  })
}

const server = http.createServer((request, response) => {
  response.write(fs.readFileSync('./index.html'))
  response.end()
})

server.listen(8080)

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
})

wsServer.on('request', function (request) {
  const connection = request.accept()
  connections.push(connection)

  connection.on('close', () => {
    connections = connections.filter((c) => c !== connection)
  })
})
;(async () => {
  await app.start(3000)

  const streamBlock = {
    type: 'video',
    title: {
      type: 'plain_text',
      text: 'Reaktor Slack Plays Pokemon',
      emoji: true,
    },
    video_url:
      'https://www.youtube.com/embed/RRxQQxiM7AA?feature=oembed&autoplay=1',
    alt_text: 'Reaktor Slack Plays Pokemon',
    thumbnail_url: 'https://i.ytimg.com/vi/RRxQQxiM7AA/hqdefault.jpg',
    provider_icon_url:
      'https://a.slack-edge.com/80588/img/unfurl_icons/youtube.png',
  } as Block

  await app.client.chat.postMessage({
    channel: process.env.SLACK_CHANNEL!,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Reaktor Slack Plays Pokemon',
        },
      },
      streamBlock,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⬆',
              emoji: true,
            },
            action_id: 'GAME_INPUT_UP',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⬇',
              emoji: true,
            },
            action_id: 'GAME_INPUT_DOWN',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⬅',
              emoji: true,
            },
            action_id: 'GAME_INPUT_LEFT',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➡️',
              emoji: true,
            },
            action_id: 'GAME_INPUT_RIGHT',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🅰️',
              emoji: true,
            },
            action_id: 'GAME_INPUT_A',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🅱️',
              emoji: true,
            },
            action_id: 'GAME_INPUT_B',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'START',
              emoji: true,
            },
            action_id: 'GAME_INPUT_START',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'SELECT',
              emoji: true,
            },
            action_id: 'GAME_INPUT_SELECT',
          },
        ],
      },
    ],
  })
})()
