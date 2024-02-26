import { CurrentSessionUser, Ship, ShipInBattle } from './models';

export function checkExistingUser(
  userData: string,
  usersCollection: Map<number, CurrentSessionUser>,
) {
  const users = Array.from(usersCollection.values()).map(
    ({ userData }) => userData,
  );
  return users.includes(userData.toString());
}

export function findUserCreatedRoom(array: string[], id: number) {
  const arrayNew = array.map((room) => {
    const parsed = JSON.parse(room)[0];
    return parsed;
  });
  const currentGame = arrayNew.filter(({ roomId }) => roomId === id);
  const userCreatedGame = currentGame[0].roomUsers[0].index;

  return userCreatedGame;
}

export function findWs(users: CurrentSessionUser[], id: number) {
  const index = users.findIndex(({ indexUser }) => indexUser === id);

  return index + 1;
}

export function generateCoord(array: string[]) {
  let randomX;
  let randomY;
  let coords;
  do {
    randomX = Math.round(Math.random() * 9);
    randomY = Math.round(Math.random() * 9);
    coords = JSON.stringify({ x: randomX, y: randomY });
  } while (array.includes(coords));

  return { x: randomX, y: randomY };
}

export function markShipsPosition(shipsFromUser: Ship[]) {
  const shipsLocation: ShipInBattle[] = [];

  let shipElement;
  shipsFromUser.forEach((ship) => {
    if (ship.length === 1) {
      shipElement = JSON.stringify({ x: ship.position.x, y: ship.position.y });
      const shipPos = [shipElement];
      shipsLocation.push({
        position: shipPos,
        length: ship.length,
        type: ship.type,
        isKill: false,
        isShot: false,
        aliveLength: ship.length,
      });
    } else {
      const shipPos = [];
      for (let i = 0; i < ship.length; i++) {
        let shipElement: string;

        if (ship.direction === true) {
          shipElement = JSON.stringify({
            x: ship.position.x,
            y: ship.position.y + i,
          });
          shipPos.push(shipElement);
        } else if (ship.direction === false) {
          shipElement = JSON.stringify({
            x: ship.position.x + i,
            y: ship.position.y,
          });
          shipPos.push(shipElement);
        }
      }
      shipsLocation.push({
        position: shipPos,
        length: ship.length,
        type: ship.type,
        isKill: false,
        isShot: false,
        aliveLength: ship.length,
      });
    }
  });
  return shipsLocation;
}
