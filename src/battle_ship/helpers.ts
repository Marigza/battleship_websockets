import { CurrentSessionUser } from './models';

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
