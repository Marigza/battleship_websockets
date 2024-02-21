import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { WebSocketServer } from 'ws';

export const httpServer = http.createServer(function (req, res) {
    const __dirname = path.resolve(path.dirname(''));
    const file_path = __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
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

const usersCollection = new Map();
let dataFromUser;
const winnersArray = [{ name: 'default winner', wins: 100 }];
let dataReady;
let updateRooms = {
    type: 'update_room',
    data: '[]',
    id: 0
};
let winnersData;
let gameData;
let players = 0;
let currentGameProps;
let socketCounter = 1;
let firstWS;
let secondWS;
let currentPos1;
let currentPos2;
let currentGamePlayer1;
let currentGamePlayer2;
let turn;

let roomsArray = [];

wss.on('connection', (ws, request) => {
    console.log('connection ready');

    ws.id = socketCounter++;

   
    ws.on('error', console.error);
 
    ws.on('message', function message(data) {
        console.log(`Received message ${data} FROM Socket N ${ws.id}`);
        dataFromUser = JSON.parse(data);

        switch (dataFromUser.type) {
            case "reg":
                dataReady = createUser(dataFromUser.data);
                winnersData = createWinners(winnersArray);

                usersCollection.set(ws.id, {indexUser: JSON.parse(dataReady.data).index, userData: dataFromUser.data });

                ws.send(JSON.stringify(dataReady));
                wss.clients.forEach((client) => {
                    client.send(JSON.stringify(winnersData));
                    client.send(JSON.stringify(updateRooms));
                })
                break;
            case "create_room":
                
                updateRooms = createRoom(JSON.parse(dataReady.data));

                roomsArray.push(updateRooms.data);
                console.log('ROOMs ARRAy', roomsArray)

                wss.clients.forEach((client) => {
                    client.send(JSON.stringify(winnersData));
                    client.send(JSON.stringify(updateRooms));
                })
                break;
            case "add_user_to_room":

                const enemyUser = findUserCreatedRoom(roomsArray, JSON.parse(dataFromUser.data).indexRoom);
                const enemyWs = findWs([...usersCollection.values()], enemyUser);

                const gameDataForAdded = createGame(JSON.parse(dataFromUser.data).indexRoom, usersCollection.get(ws.id).indexUser);
                const gameDataForCreator = createGame(JSON.parse(dataFromUser.data).indexRoom, enemyUser);

                updateRooms = {
                    type: 'update_room',
                    data: '[]',
                    id: 0
                }

                wss.clients.forEach((client) => {

                    if (client.id === ws.id) {
                        client.send(JSON.stringify(gameDataForAdded));
                    } else if (client.id === enemyWs) {
                        client.send(JSON.stringify(gameDataForCreator));
                    }
            
                    client.send(JSON.stringify(updateRooms));
                })
                break;
            case "add_ships":
                players++;
                let ships = JSON.parse(dataFromUser.data).ships;

                if (players === 1) {
                    firstWS = ws.id;
                    currentGamePlayer1 = JSON.parse(dataFromUser.data).indexPlayer
                    //console.log('firstWS', currentGamePlayer1);
                    currentPos1 = startGame(ships, currentGamePlayer1); 
                    ships = {}
                } else if (players === 2) {
                    secondWS = ws.id;
                    currentGamePlayer2 = JSON.parse(dataFromUser.data).indexPlayer
                    //console.log('secondWS', currentGamePlayer2);
                    currentPos2 = startGame(ships, currentGamePlayer2);

                    console.log('ready to start game');

                    turn = turnPlayer(currentGamePlayer2)

                    wss.clients.forEach((client) => {
                        // console.log('CLIENT WS: ', client.id);
                        // console.log('CLIENT WS1: ', firstWS);
                        // console.log('CLIENT WS2: ', secondWS);
                        if (client.id === firstWS) {
                            //console.log('currentPos1', currentPos1)
                            client.send(JSON.stringify(currentPos1));
                            client.send(JSON.stringify(turn));
                        } else if (client.id === secondWS) {
                            //console.log('currentPos2', currentPos2)
                            client.send(JSON.stringify(currentPos2));
                            client.send(JSON.stringify(turn));
                        }
                     })
                }
                break;
            case "attack":
                break;
            case "randomAttack":
                break;
            default:
        }

        console.log('users collection', usersCollection);
        //console.log(usersCollection.values())
    });

    ws.on('close', function close() {
        console.log('disconnected');
    })
    
})

function createRoom(user) {
    updateRooms = {
        type: "update_room",
        data: JSON.stringify([
           {
            roomId: Date.now(),
                roomUsers: [
                    {
                        name: user.name,
                        index: user.index,
                    },
                ],
            },
        ]),
        id: 0,
    }
    return updateRooms;
}

function createUser(userData) {
    return {
        type: "reg",
        data: JSON.stringify({
            name: JSON.parse(userData).name,
            index: Date.now(),
            error: false,
            errorText: '',
        }),
        id: 0,
    }
}

function createWinners(winners) {
    return {
        type: "update_winners",
        data: JSON.stringify(winners),
        id: 0,
        }
}

function deleteOccupiedRoom(roomIndex) {
    console.log('deleteFunc data=', updateRooms.data)
    console.log('deleteFunc index=', roomIndex)

}

function writePlayers(user1, user2) { }

function createGame(game, player) {
    console.log('create:game', game)
    console.log('create:player', player)
    return {
        type: "create_game", 
        data: JSON.stringify(
            {
                idGame: game,
                idPlayer: player,
            }
        ),
        id: 0,
    }
}

function findUserCreatedRoom(array, Id) {
    const arrayNew = array.map(room => {
        return JSON.parse(room);
    })
    const currentGame = arrayNew[0].filter(({ roomId }) => roomId === Id);
    const userCreatedGame = currentGame[0].roomUsers[0].index;

    return userCreatedGame;
}

function findWs(users, id) {
    const index = users.findIndex(({ indexUser }) => indexUser === id);

    return index + 1;
}

function startGame(shipsPlace, index) {
    return {
        type: "start_game",
        data: JSON.stringify({
            ships: shipsPlace,
            currentPlayerIndex: index
        }),
        id: 0,
    }
}
    
function turnPlayer(currentPlayer) {
    let index = currentPlayer === currentGamePlayer2 ? currentGamePlayer2 : currentGamePlayer1
    return {
        type: "turn",
        data: JSON.stringify(
            {
                currentPlayer: index,
            },
        ),
        id: 0,
    }
}

