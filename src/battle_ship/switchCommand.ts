import {
  CommandData,
  CustomSocket,
  Winner,
  CurrentSessionUser,
  Attack,
  ShipInBattle,
} from './models';
import {
  checkExistingUser,
  findUserCreatedRoom,
  findWs,
  generateCoord,
} from './helpers';
import {
  game,
  createRegError,
  createUser,
  createWinners,
  createRoom,
  createGame,
  startGame,
  turnPlayer,
  createAnswerForAttack,
  setFinishGame,
} from './generateCommands';

const usersCollection = new Map<number, CurrentSessionUser>();
const winnersArray: Winner[] = [{ name: 'default winner', wins: 100 }];
let dataReady: CommandData;
let updateRooms = {
  type: 'update_room',
  data: '[]',
  id: 0,
};
let winnersData: CommandData;
let players = 0;
let firstWS: number;
let secondWS: number;
let currentPos1: CommandData;
let currentPos2: CommandData;
let currentGamePlayer1: number;
let currentGamePlayer2: number;
let turn: CommandData;
const killedCount = new Map();
let blockedPlayer: number;

const roomsArray: string[] = [];
const arrayOfAttack = new Map();
export const SocketArray: CustomSocket[] = [];

export function switchCommand(dataFromUser: CommandData, ws: CustomSocket) {
  switch (dataFromUser.type) {
    case 'reg':
      const isUserExist = checkExistingUser(dataFromUser.data, usersCollection);
      if (isUserExist) {
        const error = createRegError(dataFromUser.data);
        ws.send(JSON.stringify(error));
      } else {
        dataReady = createUser(dataFromUser.data);
        winnersData = createWinners(winnersArray);

        usersCollection.set(ws.id, {
          indexUser: JSON.parse(dataReady.data).index,
          userData: dataFromUser.data,
        });

        ws.send(JSON.stringify(dataReady));

        SocketArray.forEach((client) => {
          client.send(JSON.stringify(winnersData));
          client.send(JSON.stringify(updateRooms));
        });
      }
      break;
    case 'create_room':
      updateRooms = createRoom(JSON.parse(dataReady.data));

      roomsArray.push(updateRooms.data);

      SocketArray.forEach((client) => {
        client.send(JSON.stringify(winnersData));
        client.send(JSON.stringify(updateRooms));
      });
      break;
    case 'add_user_to_room':
      const enemyUser = findUserCreatedRoom(
        roomsArray,
        JSON.parse(dataFromUser.data).indexRoom,
      );
      const enemyWs = findWs([...usersCollection.values()], enemyUser);

      const gameDataForAdded = createGame(
        JSON.parse(dataFromUser.data).indexRoom,
        ws.id && usersCollection.get(ws.id)!.indexUser,
      );
      const gameDataForCreator = createGame(
        JSON.parse(dataFromUser.data).indexRoom,
        enemyUser,
      );

      updateRooms = {
        type: 'update_room',
        data: '[]',
        id: 0,
      };

      SocketArray.forEach((client) => {
        if (client.id === ws.id) {
          client.send(JSON.stringify(gameDataForAdded));
        } else if (client.id === enemyWs) {
          client.send(JSON.stringify(gameDataForCreator));
        }

        client.send(JSON.stringify(updateRooms));
      });
      break;
    case 'add_ships':
      players++;
      let ships = JSON.parse(dataFromUser.data).ships;

      if (players === 1) {
        firstWS = ws.id;
        currentGamePlayer1 = JSON.parse(dataFromUser.data).indexPlayer;
        currentPos1 = startGame(ships, currentGamePlayer1);
        ships = {};
      } else if (players === 2) {
        secondWS = ws.id;
        currentGamePlayer2 = JSON.parse(dataFromUser.data).indexPlayer;
        currentPos2 = startGame(ships, currentGamePlayer2);

        console.log('ready to start game');

        turn = turnPlayer(currentGamePlayer2);
        killedCount.set(currentGamePlayer2, 0);
        killedCount.set(currentGamePlayer1, 0);

        SocketArray.forEach((client) => {
          if (client.id === firstWS) {
            client.send(JSON.stringify(currentPos1));
            client.send(JSON.stringify(turn));
          } else if (client.id === secondWS) {
            client.send(JSON.stringify(currentPos2));
            client.send(JSON.stringify(turn));
          }
        });
      }
      break;
    case 'attack':
      const attack = JSON.parse(dataFromUser.data);
      const enemy =
        attack.indexPlayer === currentGamePlayer1
          ? currentGamePlayer2
          : currentGamePlayer1;
      setAttackStatus(attack, enemy, ws.id);
      break;
    case 'randomAttack':
      const playerData = JSON.parse(dataFromUser.data);
      const player = playerData.indexPlayer;
      const currentEnemy =
        player === currentGamePlayer1 ? currentGamePlayer2 : currentGamePlayer1;
      const gameId = playerData.gameId;
      const array = arrayOfAttack.get(currentEnemy) ?? [];
      const { x, y } = generateCoord(array);
      const randomAttack = { gameId, x, y, indexPlayer: player };
      setAttackStatus(randomAttack, currentEnemy, ws.id);
      break;
    default:
  }
}

function setAttackStatus(attack: Attack, enemy: number, socketId: number) {
  if (attack.indexPlayer === blockedPlayer) {
    return;
  }
  const attackCoord = JSON.stringify({ x: attack.x, y: attack.y });
  const attackArray = arrayOfAttack.get(enemy) ?? [];
  attackArray.push(attackCoord);
  arrayOfAttack.set(enemy, attackArray);
  const enemyField: ShipInBattle[] = game.get(enemy);
  let attackStatus = 'miss';
  let killedShip;
  const enemyAfterAttack = enemyField.map((ship) => {
    if (ship.position.includes(attackCoord)) {
      ship.isShot = true;
      ship.aliveLength = ship.aliveLength - 1;
      attackStatus = ship.aliveLength === 0 ? 'killed' : 'shot';
      if (attackStatus === 'killed') {
        killedShip = ship.position;
        let countOfGame = killedCount.get(attack.indexPlayer);
        countOfGame++;
        killedCount.set(attack.indexPlayer, countOfGame);
        if (countOfGame === 10) {
          showFinish(attack.indexPlayer, socketId);
        }
      }
      return ship;
    }
    return ship;
  });
  game.set(enemy, enemyAfterAttack);
  switchAttackStatus(
    attackStatus,
    attack.indexPlayer,
    enemy,
    attackCoord,
    killedShip,
  );
}

function switchAttackStatus(
  status: string,
  player: number,
  enemy: number,
  attackCoord: string,
  killedShip: string[] | undefined,
) {
  let attackAnswer: CommandData;

  if (status === 'miss') {
    attackAnswer = createAnswerForAttack('miss', player, attackCoord);
    turn = turnPlayer(enemy);
    blockedPlayer = player;
    SocketArray.forEach((client) => {
      if (client.id === firstWS) {
        client.send(JSON.stringify(attackAnswer));
      } else if (client.id === secondWS) {
        client.send(JSON.stringify(attackAnswer));
      }
    });
  } else if (status === 'killed') {
    // TODO here need to create arrays of answers for each coord around killed ship with status 'miss':
    // add to 'arrayOfAttack' ceils with status 'miss' after killing ship
    turn = turnPlayer(player);
    blockedPlayer = enemy;
    killedShip &&
      killedShip.forEach((coord) => {
        attackAnswer = createAnswerForAttack('killed', player, coord);
        SocketArray.forEach((client) => {
          if (client.id === firstWS) {
            client.send(JSON.stringify(attackAnswer));
          } else if (client.id === secondWS) {
            client.send(JSON.stringify(attackAnswer));
          }
        });
      });
  } else if (status === 'shot') {
    attackAnswer = createAnswerForAttack('shot', player, attackCoord);
    turn = turnPlayer(player);
    blockedPlayer = enemy;
    SocketArray.forEach((client) => {
      if (client.id === firstWS) {
        client.send(JSON.stringify(attackAnswer));
      } else if (client.id === secondWS) {
        client.send(JSON.stringify(attackAnswer));
      }
    });
  }
  SocketArray.forEach((client) => {
    if (client.id === firstWS) {
      client.send(JSON.stringify(turn));
    } else if (client.id === secondWS) {
      client.send(JSON.stringify(turn));
    }
  });
}

function showFinish(player: number, socketId: number) {
  console.log('finish game');
  const finishGame = setFinishGame(player);
  const winnerName = JSON.parse(usersCollection.get(socketId)!.userData).name;
  winnersArray.push({ name: winnerName, wins: 1 });
  winnersData = createWinners(winnersArray);
  SocketArray.forEach((client) => {
    if (client.id === firstWS) {
      client.send(JSON.stringify(finishGame));
    } else if (client.id === secondWS) {
      client.send(JSON.stringify(finishGame));
    }
    client.send(JSON.stringify(winnersData));
  });
}

// function deleteOccupiedRoom(roomIndex) {
//     console.log('deleteFunc data=', updateRooms.data)
//     console.log('deleteFunc index=', roomIndex)

// }

// function writePlayers(user1, user2) { }
