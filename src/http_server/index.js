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
let players = 0;
let socketCounter = 1;
let firstWS;
let secondWS;
let currentPos1;
let currentPos2;
let currentGamePlayer1;
let currentGamePlayer2;
let turn;
let game = new Map();
let killedCount = new Map();
let blockedPlayer;

let roomsArray = [];
let arrayOfAttack = new Map() // TODO coords of attacks(strings). Need for implement randomAttack.

wss.on('connection', (ws, request) => {
    console.log('connection ready');

    ws.id = socketCounter++;

    ws.on('error', console.error);
 
    ws.on('message', function message(data) {
        //console.log(`Received message ${data} FROM Socket N ${ws.id}`);
        dataFromUser = JSON.parse(data);

        switch (dataFromUser.type) {
            case "reg":
                const isUserExist = checkExistingUser(dataFromUser.data)
                if (isUserExist) {
                    const error = createRegError(dataFromUser.data);
                    ws.send(JSON.stringify(error));
                } else {
                    dataReady = createUser(dataFromUser.data);
                    winnersData = createWinners(winnersArray);

                    usersCollection.set(ws.id, { indexUser: JSON.parse(dataReady.data).index, userData: dataFromUser.data });

                    ws.send(JSON.stringify(dataReady));

                    wss.clients.forEach((client) => {
                        client.send(JSON.stringify(winnersData));
                        client.send(JSON.stringify(updateRooms));
                    })
                }
                break;
            case "create_room":
                
                updateRooms = createRoom(JSON.parse(dataReady.data));

                roomsArray.push(updateRooms.data);

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
                    currentPos1 = startGame(ships, currentGamePlayer1); 
                    ships = {}
                } else if (players === 2) {
                    secondWS = ws.id;
                    currentGamePlayer2 = JSON.parse(dataFromUser.data).indexPlayer
                    currentPos2 = startGame(ships, currentGamePlayer2);

                    console.log('ready to start game');

                    turn = turnPlayer(currentGamePlayer2)
                    killedCount.set(currentGamePlayer2, 0);
                    killedCount.set(currentGamePlayer1, 0);

                    wss.clients.forEach((client) => {
                        if (client.id === firstWS) {
                            client.send(JSON.stringify(currentPos1));
                            client.send(JSON.stringify(turn));
                        } else if (client.id === secondWS) {
                            client.send(JSON.stringify(currentPos2));
                            client.send(JSON.stringify(turn));
                        }
                     })
                }
                break;
            case "attack":
                const attack = JSON.parse(dataFromUser.data);
                console.log('notRandomAttack:', attack);
                const enemy = attack.indexPlayer === currentGamePlayer1 ? currentGamePlayer2 : currentGamePlayer1;
                setAttackStatus(attack, enemy, ws.id);
                break;
            case "randomAttack":
                const playerData = JSON.parse(dataFromUser.data);
                const player = playerData.indexPlayer;
                const currentEnemy = player === currentGamePlayer1 ? currentGamePlayer2 : currentGamePlayer1;
                const gameId = playerData.gameId;
                const array = arrayOfAttack.get(currentEnemy);
                console.log('array of attacks', array);
                const { x, y } = generateCoord(array);
                const randomAttack = { gameId, x, y, indexPlayer: player };
                setAttackStatus(randomAttack, currentEnemy, ws.id);
                break;
            default:
        }

        //console.log('users collection', usersCollection);
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

function checkExistingUser(userData) {
    const users = Array.from(usersCollection.values()).map(({userData})=>userData);
    return users.includes((userData).toString());
}

function createRegError(userData) {
    return {
        type: "reg",
        data: JSON.stringify({
            name: JSON.parse(userData).name,
            index: 0,
            error: true,
            errorText: `user ${JSON.parse(userData).name} already login`,
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
    const ships = markShipsPosition(shipsPlace);
    game.set(index, ships);
    return {
        type: "start_game",
        data: JSON.stringify({
            ships: shipsPlace,
            currentPlayerIndex: index
        }),
        id: 0,
    }
}

function setAttackStatus(attack, enemy, socketId) {
    if (attack.indexPlayer === blockedPlayer) {
        return;
    }
    const attackCoord = JSON.stringify({ x: attack.x, y: attack.y });
    console.log('Attack coords = ', attackCoord)
    const attackArray = arrayOfAttack.get(enemy) ?? [];
    attackArray.push(attackCoord)
    arrayOfAttack.set(enemy, attackArray)
    const enemyField = game.get(enemy);
    let attackStatus = 'miss';
    let killedShip;
    const enemyAfterAttack = enemyField.map(ship => {
        if (ship.position.includes(attackCoord)) {
            ship.isShot = true;
            ship.aliveLength = ship.aliveLength - 1;
            attackStatus = (ship.aliveLength === 0 ? 'killed' : 'shot');
            if (attackStatus === 'killed') {
                killedShip = ship.position;
                let countOfGame = killedCount.get(attack.indexPlayer)
                countOfGame++;
                killedCount.set(attack.indexPlayer, countOfGame);
                if (countOfGame === 10) {
                    showFinish(attack.indexPlayer, socketId);
                }
            }
            return ship;
        }
        return ship;
    })
    game.set(enemy, enemyAfterAttack);
    switchAttackStatus(attackStatus, attack.indexPlayer, enemy, attackCoord, killedShip);
}

function switchAttackStatus(status, player, enemy, attackCoord, killedShip) {
    let attackAnswer1;

    if (status === 'miss') {
        attackAnswer1 = createAnswerForAttack('miss', player, attackCoord);
        turn = turnPlayer(enemy);
        blockedPlayer = player;
        wss.clients.forEach((client) => {
            if (client.id === firstWS) {
                client.send(JSON.stringify(attackAnswer1));
            } else if (client.id === secondWS) {
                client.send(JSON.stringify(attackAnswer1));
            }
        })
    } else if (status === 'killed') {
        // TODO here need to create arrays of answers for each coord around killed ship with status 'miss':
        // add to 'arrayOfAttack' ceils with status 'miss' after killing ship 
        turn = turnPlayer(player);
        blockedPlayer = enemy;
        killedShip.forEach(coord => {
            attackAnswer1 = createAnswerForAttack('killed', player, coord);
            wss.clients.forEach((client) => {
                if (client.id === firstWS) {
                    client.send(JSON.stringify(attackAnswer1));
                } else if (client.id === secondWS) {
                    client.send(JSON.stringify(attackAnswer1));
                }
            })
        })
    } else if (status === 'shot') {
        attackAnswer1 = createAnswerForAttack('shot', player, attackCoord)
        turn = turnPlayer(player);
        blockedPlayer = enemy;
        wss.clients.forEach((client) => {
            if (client.id === firstWS) {
                client.send(JSON.stringify(attackAnswer1));
            } else if (client.id === secondWS) {
                client.send(JSON.stringify(attackAnswer1));
            }
        })
    }
    wss.clients.forEach((client) => {
        if (client.id === firstWS) {
            client.send(JSON.stringify(turn));
        } else if (client.id === secondWS) {
            client.send(JSON.stringify(turn));
        }
    })

}
    
function turnPlayer(nextPlayer) {
    return {
        type: "turn",
        data: JSON.stringify(
            {
                currentPlayer: nextPlayer,
            },
        ),
        id: 0,
    }
}

function markShipsPosition(shipsFromUser) {
    const shipsLocation = [];
   
    let shipElement;
    shipsFromUser.forEach((ship) => {
        if (ship.length === 1) {
            shipElement = JSON.stringify({ x: ship.position.x, y: ship.position.y });
            const shipPos = [shipElement]
            shipsLocation.push({
                position: shipPos,
                length: ship.length,
                type: ship.type,
                isKill: false,
                isShot: false,
                aliveLength: ship.length
            });
        } else {
            let shipPos = []
            for (let i = 0; i < ship.length; i++) {
                let shipElement;
               
                if (ship.direction === true) {
                    shipElement = JSON.stringify({ x: ship.position.x, y: ship.position.y + i });
                    shipPos.push(shipElement);
                } else if (ship.direction === false) {
                    shipElement = JSON.stringify({ x: ship.position.x + i, y: ship.position.y });
                    shipPos.push(shipElement);
                }
            }
            shipsLocation.push({
                position: shipPos,
                length: ship.length,
                type: ship.type,
                isKill: false,
                isShot: false,
                aliveLength: ship.length
            });
        }
    })
    return shipsLocation
}

function createAnswerForAttack(status, player, position) {
    return {
        type: "attack",
        data: JSON.stringify(
            {
                position: JSON.parse(position),
                currentPlayer: player,
                status: status,
            }), 
        id: 0
    }
}

function setFinishGame(indexPlayer) {
    return {
        type: "finish",
        data: JSON.stringify(
            {
                winPlayer: indexPlayer,
            }
        ),
        id: 0,
    }
}

function showFinish(player, socketId) {
    console.log('finish game')
    const finishGame = setFinishGame(player)
    const winnerName = JSON.parse(usersCollection.get(socketId).userData).name
    winnersArray.push({ name: winnerName, wins: 1 });
    winnersData = createWinners(winnersArray);
    wss.clients.forEach((client) => {
        if (client.id === firstWS) {
            client.send(JSON.stringify(finishGame));
        } else if (client.id === secondWS) {
            client.send(JSON.stringify(finishGame));
        }
        client.send(JSON.stringify(winnersData));
    })
}

function generateCoord(array) {
    let randomX;
    let randomY;
    let coords;
    do {
        randomX = Math.round(Math.random() * 9);
        randomY = Math.round(Math.random() * 9);
        coords = JSON.stringify({ x: randomX, y: randomY });
    } while (array.includes(coords));

    console.log('random coords x,y:', coords);
    return {x: randomX, y: randomY}
}
