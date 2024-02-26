import { AnswerType } from './answerType';
import { markShipsPosition } from './helpers';
import { Ship, UserRegistration, Winner } from './models';

export const game = new Map();

export function createRoom(user: UserRegistration): AnswerType {
  return {
    type: 'update_room',
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
  };
}

export function createUser(userData: string): AnswerType {
  return {
    type: 'reg',
    data: JSON.stringify({
      name: JSON.parse(userData).name,
      index: Date.now(),
      error: false,
      errorText: '',
    }),
    id: 0,
  };
}

export function createRegError(userData: string): AnswerType {
  return {
    type: 'reg',
    data: JSON.stringify({
      name: JSON.parse(userData).name,
      index: 0,
      error: true,
      errorText: `user ${JSON.parse(userData).name} already login`,
    }),
    id: 0,
  };
}

export function createWinners(winners: Winner[]): AnswerType {
  return {
    type: 'update_winners',
    data: JSON.stringify(winners),
    id: 0,
  };
}

export function createGame(game: number, player: number): AnswerType {
  return {
    type: 'create_game',
    data: JSON.stringify({
      idGame: game,
      idPlayer: player,
    }),
    id: 0,
  };
}

export function startGame(shipsPlace: Ship[], index: number): AnswerType {
  const ships = markShipsPosition(shipsPlace);
  game.set(index, ships);
  return {
    type: 'start_game',
    data: JSON.stringify({
      ships: shipsPlace,
      currentPlayerIndex: index,
    }),
    id: 0,
  };
}

export function turnPlayer(nextPlayer: number): AnswerType {
  return {
    type: 'turn',
    data: JSON.stringify({
      currentPlayer: nextPlayer,
    }),
    id: 0,
  };
}

export function createAnswerForAttack(
  status: string,
  player: number,
  position: string,
): AnswerType {
  return {
    type: 'attack',
    data: JSON.stringify({
      position: JSON.parse(position),
      currentPlayer: player,
      status: status,
    }),
    id: 0,
  };
}

export function setFinishGame(indexPlayer: number): AnswerType {
  return {
    type: 'finish',
    data: JSON.stringify({
      winPlayer: indexPlayer,
    }),
    id: 0,
  };
}
