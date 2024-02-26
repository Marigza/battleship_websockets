import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { WebSocketServer } from 'ws';

import { CommandData, CustomSocket } from '../battle_ship/models';
import { SocketArray, switchCommand } from '../battle_ship/switchCommand';

export const httpServer = http.createServer(function (req, res) {
  const __dirname = path.resolve(path.dirname(''));
  const file_path =
    __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
  fs.readFile(file_path, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

export const wss = new WebSocketServer({ port: 3000 });

let dataFromUser: CommandData;
let socketCounter = 1;

wss.on('connection', (ws: CustomSocket) => {
  console.log('connection ready');

  ws.id = socketCounter++;

  SocketArray.push(ws);

  ws.on('error', console.error);

  ws.on('message', function message(data) {
    const dataToString = data.toString();
    dataFromUser = JSON.parse(dataToString);

    switchCommand(dataFromUser, ws);
  });

  ws.on('close', function close() {
    console.log('disconnected');
  });
});
